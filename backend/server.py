from __future__ import annotations

import json
import os
import uuid
from datetime import date as Date
from typing import Any, Dict, List, Tuple

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # In production you can restrict origins if you want.

# ----------------------------
# File locations (server-side)
# ----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
LOGS_PATH = os.path.join(DATA_DIR, "logs.json")
SEED_PATH = os.path.join(DATA_DIR, "seed.json")

PAGE_SIZE_DEFAULT = 10
PAGE_SIZE_MAX = 50

YDS_GRADES = ["5.2","5.3","5.4","5.5","5.6","5.7","5.8","5.9","5.10","5.11","5.12","5.13","5.14","5.15"]
V_GRADES = [f"V{i}" for i in range(18)]  # V0..V17


# ----------------------------
# Helpers: load/save/init
# ----------------------------
def ensure_data_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


def read_json_file(path: str, default: Any) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except json.JSONDecodeError:
        # If file is corrupted, fail safe to default (you may prefer raising)
        return default


def write_json_file(path: str, data: Any) -> None:
    tmp_path = path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, path)


def load_logs() -> List[Dict[str, Any]]:
    """
    Loads logs from logs.json.
    If missing, initializes from seed.json (must contain a JSON array of >= 30 objects).
    """
    ensure_data_dir()

    logs = read_json_file(LOGS_PATH, default=None)
    if isinstance(logs, list) and len(logs) > 0:
        return logs

    # Initialize from seed.json if logs.json doesn't exist or is empty
    seed = read_json_file(SEED_PATH, default=[])
    if not isinstance(seed, list):
        seed = []

    # Enforce minimum 30 records requirement on initial boot
    if len(seed) < 30:
        # If you want strict behavior:
        # raise RuntimeError("seed.json must contain at least 30 records")
        # We'll still write whatever exists, but your assignment requires 30.
        pass

    write_json_file(LOGS_PATH, seed)
    return seed


def save_logs(logs: List[Dict[str, Any]]) -> None:
    ensure_data_dir()
    write_json_file(LOGS_PATH, logs)


def find_log_index(logs: List[Dict[str, Any]], log_id: str) -> int:
    for i, l in enumerate(logs):
        if str(l.get("id")) == str(log_id):
            return i
    return -1


# ----------------------------
# Validation (server-side)
# ----------------------------
def today_yyyy_mm_dd() -> str:
    d = Date.today()
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def validate_payload(p: Dict[str, Any], is_update: bool = False) -> Dict[str, str]:
    """
    Match client-side rules from app.js:
    required fields, no future date, grade system rules, grade ranges.
    """
    err: Dict[str, str] = {}

    def is_blank(v: Any) -> bool:
        return v is None or str(v).strip() == ""

    # Required fields
    if is_blank(p.get("date")):
        err["date"] = "Date is required."
    else:
        # Expect YYYY-MM-DD string, compare lexicographically
        if str(p["date"]) > today_yyyy_mm_dd():
            err["date"] = "Date cannot be in the future."

    if is_blank(p.get("environment")):
        err["environment"] = "Environment is required."
    if is_blank(p.get("location")):
        err["location"] = "Location is required."
    if is_blank(p.get("routeName")):
        err["routeName"] = "Route name is required."
    if is_blank(p.get("climbType")):
        err["climbType"] = "Climb type is required."
    if is_blank(p.get("gradeSystem")):
        err["gradeSystem"] = "Grade system is required."
    if is_blank(p.get("grade")):
        err["grade"] = "Grade is required."
    if is_blank(p.get("progress")):
        err["progress"] = "Progress is required."

    climb_type = str(p.get("climbType") or "")
    grade_system = str(p.get("gradeSystem") or "")
    grade = str(p.get("grade") or "")

    # Domain-specific rule: boulders use V scale; roped climbs use YDS
    if climb_type == "boulder" and grade_system and grade_system != "V":
        err["gradeSystem"] = "Bouldering should use V-Scale."
    if climb_type != "boulder" and grade_system and grade_system != "YDS":
        err["gradeSystem"] = "Roped climbs should use YDS."

    # Grade range rules
    if climb_type == "boulder":
        if grade_system == "V" and grade and grade not in V_GRADES:
            err["grade"] = "Bouldering grades must be between V0 and V17."
    else:
        if grade_system == "YDS" and grade and grade not in YDS_GRADES:
            err["grade"] = "Roped climb grades must be between 5.2 and 5.15."

    return err


# ----------------------------
# Routes
# ----------------------------
@app.get("/")
def home():
    return jsonify({
        "message": "Climbing Log API is running",
        "health": "/api/health"
    })

@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/logs")
def list_logs():
    logs = load_logs()

    # Query params
    page = int(request.args.get("page", "1"))
    page_size = int(request.args.get("pageSize", str(PAGE_SIZE_DEFAULT)))
    q = (request.args.get("q") or "").strip().lower()

    if page < 1:
        page = 1
    if page_size < 1:
        page_size = PAGE_SIZE_DEFAULT
    if page_size > PAGE_SIZE_MAX:
        page_size = PAGE_SIZE_MAX

    filtered = logs
    if q:
        def matches(l: Dict[str, Any]) -> bool:
            rn = str(l.get("routeName", "")).lower()
            loc = str(l.get("location", "")).lower()
            return q in rn or q in loc

        filtered = [l for l in logs if matches(l)]

    total = len(filtered)

    # Sort: newest date first (optional but nice)
    filtered.sort(key=lambda l: str(l.get("date", "")), reverse=True)

    start = (page - 1) * page_size
    end = start + page_size
    items = filtered[start:end]

    return jsonify({
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size
    })


@app.get("/api/logs/<log_id>")
def get_log(log_id: str):
    logs = load_logs()
    idx = find_log_index(logs, log_id)
    if idx < 0:
        return jsonify({"message": "Not found"}), 404
    return jsonify(logs[idx])


@app.post("/api/logs")
def create_log():
    logs = load_logs()
    payload = request.get_json(silent=True) or {}

    errors = validate_payload(payload, is_update=False)
    if errors:
        return jsonify({"message": "Validation failed", "errors": errors}), 400

    new_id = str(uuid.uuid4())
    record = {
        "id": new_id,
        "date": str(payload.get("date", "")).strip(),
        "environment": str(payload.get("environment", "")).strip(),
        "location": str(payload.get("location", "")).strip(),
        "routeName": str(payload.get("routeName", "")).strip(),
        "climbType": str(payload.get("climbType", "")).strip(),
        "gradeSystem": str(payload.get("gradeSystem", "")).strip(),
        "grade": str(payload.get("grade", "")).strip(),
        "progress": str(payload.get("progress", "")).strip(),
    }

    logs.append(record)
    save_logs(logs)
    return jsonify(record), 201


@app.put("/api/logs/<log_id>")
def update_log(log_id: str):
    logs = load_logs()
    idx = find_log_index(logs, log_id)
    if idx < 0:
        return jsonify({"message": "Not found"}), 404

    payload = request.get_json(silent=True) or {}

    errors = validate_payload(payload, is_update=True)
    if errors:
        return jsonify({"message": "Validation failed", "errors": errors}), 400

    # Keep id stable
    record = logs[idx]
    record.update({
        "date": str(payload.get("date", "")).strip(),
        "environment": str(payload.get("environment", "")).strip(),
        "location": str(payload.get("location", "")).strip(),
        "routeName": str(payload.get("routeName", "")).strip(),
        "climbType": str(payload.get("climbType", "")).strip(),
        "gradeSystem": str(payload.get("gradeSystem", "")).strip(),
        "grade": str(payload.get("grade", "")).strip(),
        "progress": str(payload.get("progress", "")).strip(),
    })

    logs[idx] = record
    save_logs(logs)
    return jsonify(record)


@app.delete("/api/logs/<log_id>")
def delete_log(log_id: str):
    logs = load_logs()
    idx = find_log_index(logs, log_id)
    if idx < 0:
        return jsonify({"message": "Not found"}), 404

    deleted = logs.pop(idx)
    save_logs(logs)
    return jsonify({"deleted": True, "id": deleted.get("id")})


@app.get("/api/stats")
def stats():
    logs = load_logs()
    total = len(logs)
    complete = sum(1 for l in logs if str(l.get("progress")) == "complete")
    completion_rate = 0 if total == 0 else round((complete / total) * 100, 2)  # percent 0..100

    by_type: Dict[str, int] = {}
    for l in logs:
        t = str(l.get("climbType", "unknown"))
        by_type[t] = by_type.get(t, 0) + 1

    return jsonify({
        "total": total,
        "completionRate": completion_rate,
        "byType": by_type
    })


if __name__ == "__main__":
    # Local dev
    app.run(host="0.0.0.0", port=5000, debug=True)
