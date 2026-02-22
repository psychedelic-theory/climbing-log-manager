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


def _parse_csv(arg: str | None) -> List[str]:
    if not arg:
        return []
    return [x.strip() for x in arg.split(",") if x.strip()]


def _yds_key(g: str) -> int:
    # Expected like "5.10" .. "5.15" or "5.2" etc.
    try:
        s = g.strip().lower()
        if not s.startswith("5."):
            return -1
        num = s.split("5.", 1)[1]
        # ignore suffixes like a/b/c/d if present (not used in this project)
        num = "".join(ch for ch in num if ch.isdigit())
        return 500 + int(num)
    except Exception:
        return -1


def _v_key(g: str) -> int:
    # Expected like "V0" .. "V17"
    try:
        s = g.strip().upper()
        if not s.startswith("V"):
            return -1
        return int(s[1:])
    except Exception:
        return -1


def ensure_data_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


def load_logs() -> List[Dict[str, Any]]:
    ensure_data_dir()
    if not os.path.exists(LOGS_PATH):
        # If logs.json doesn't exist, seed it (at least 30 records required later)
        seed_logs()
    with open(LOGS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_logs(logs: List[Dict[str, Any]]) -> None:
    ensure_data_dir()
    with open(LOGS_PATH, "w", encoding="utf-8") as f:
        json.dump(logs, f, indent=2)


def seed_logs() -> None:
    ensure_data_dir()
    if os.path.exists(SEED_PATH):
        with open(SEED_PATH, "r", encoding="utf-8") as f:
            seed = json.load(f)
        save_logs(seed)
        return
    save_logs([])


def validate_payload(payload: Dict[str, Any]) -> Dict[str, str]:
    errors: Dict[str, str] = {}

    required_fields = ["date", "environment", "location", "routeName", "climbType", "gradeSystem", "grade", "progress"]
    for field in required_fields:
        if not str(payload.get(field, "")).strip():
            errors[field] = f"{field} is required."

    # Date not in the future
    date_str = str(payload.get("date", "")).strip()
    if date_str:
        try:
            y, m, d = map(int, date_str.split("-"))
            dt = Date(y, m, d)
            if dt > Date.today():
                errors["date"] = "Date cannot be in the future."
        except Exception:
            errors["date"] = "Date must be YYYY-MM-DD."

    environment = payload.get("environment")
    if environment and environment not in ("gym", "outdoor"):
        errors["environment"] = "Environment must be gym or outdoor."

    climb_type = payload.get("climbType")
    if climb_type and climb_type not in ("top-rope", "sport", "trad", "boulder"):
        errors["climbType"] = "Invalid climb type."

    progress = payload.get("progress")
    if progress and progress not in ("complete", "incomplete"):
        errors["progress"] = "Progress must be complete or incomplete."

    grade_system = payload.get("gradeSystem")
    grade = str(payload.get("grade", "")).strip()

    # Domain rule: boulder uses V, roped uses YDS
    if climb_type == "boulder":
        if grade_system and grade_system != "V":
            errors["gradeSystem"] = "Bouldering should use V-Scale."
        if grade_system == "V" and grade:
            if _v_key(grade) < 0 or _v_key(grade) > 17:
                errors["grade"] = "Bouldering grades must be between V0 and V17."
    else:
        if grade_system and grade_system != "YDS":
            errors["gradeSystem"] = "Roped climbs should use YDS."
        if grade_system == "YDS" and grade:
            # expected 5.2 .. 5.15 (based on your client list)
            k = _yds_key(grade)
            if k < 502 or k > 515:
                errors["grade"] = "Roped climb grades must be between 5.2 and 5.15."

    return errors


@app.get("/")
def root():
    return jsonify({"health": "/api/health", "message": "Climbing Log API is running"})


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

    envs = _parse_csv(request.args.get("env"))
    types = _parse_csv(request.args.get("type"))
    progress = _parse_csv(request.args.get("progress"))
    sort = (request.args.get("sort") or "date_desc").strip()

    if page < 1:
        page = 1
    if page_size < 1:
        page_size = PAGE_SIZE_DEFAULT
    if page_size > PAGE_SIZE_MAX:
        page_size = PAGE_SIZE_MAX

    filtered: List[Dict[str, Any]] = logs

    # Search
    if q:
        def matches(l: Dict[str, Any]) -> bool:
            rn = str(l.get("routeName", "")).lower()
            loc = str(l.get("location", "")).lower()
            return q in rn or q in loc
        filtered = [l for l in filtered if matches(l)]

    # Filters
    if envs:
        env_set = set(envs)
        filtered = [l for l in filtered if str(l.get("environment", "")) in env_set]

    if types:
        type_set = set(types)
        filtered = [l for l in filtered if str(l.get("climbType", "")) in type_set]

    if progress:
        prog_set = set(progress)
        filtered = [l for l in filtered if str(l.get("progress", "")) in prog_set]

    total = len(filtered)

    def sort_date_desc():
        filtered.sort(key=lambda l: str(l.get("date", "")), reverse=True)

    if sort == "date_asc":
        filtered.sort(key=lambda l: str(l.get("date", "")))
    elif sort == "date_desc":
        sort_date_desc()
    elif sort == "location_asc":
        filtered.sort(key=lambda l: str(l.get("location", "")).lower())
    elif sort == "location_desc":
        filtered.sort(key=lambda l: str(l.get("location", "")).lower(), reverse=True)
    elif sort == "route_asc":
        filtered.sort(key=lambda l: str(l.get("routeName", "")).lower())
    elif sort == "route_desc":
        filtered.sort(key=lambda l: str(l.get("routeName", "")).lower(), reverse=True)
    elif sort in ("grade_asc", "grade_desc"):
        systems = {str(l.get("gradeSystem", "")) for l in filtered if l.get("gradeSystem")}
        # Only allow grade sorting when the filtered result set has ONE grade system
        if len(systems) == 1:
            sys = next(iter(systems))
            if sys == "YDS":
                filtered.sort(key=lambda l: _yds_key(str(l.get("grade", ""))), reverse=(sort == "grade_desc"))
            elif sys == "V":
                filtered.sort(key=lambda l: _v_key(str(l.get("grade", ""))), reverse=(sort == "grade_desc"))
            else:
                sort_date_desc()
        else:
            sort_date_desc()
    else:
        sort_date_desc()

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
    for l in logs:
        if l.get("id") == log_id:
            return jsonify(l)
    return jsonify({"message": "Not found"}), 404


@app.post("/api/logs")
def create_log():
    payload = request.get_json(force=True) or {}
    errors = validate_payload(payload)
    if errors:
        return jsonify({"errors": errors, "message": "Validation failed"}), 400

    logs = load_logs()
    new_id = str(uuid.uuid4())
    payload["id"] = new_id
    logs.append(payload)
    save_logs(logs)
    return jsonify(payload), 201


@app.put("/api/logs/<log_id>")
def update_log(log_id: str):
    payload = request.get_json(force=True) or {}
    payload["id"] = log_id

    errors = validate_payload(payload)
    if errors:
        return jsonify({"errors": errors, "message": "Validation failed"}), 400

    logs = load_logs()
    for i, l in enumerate(logs):
        if l.get("id") == log_id:
            logs[i] = payload
            save_logs(logs)
            return jsonify(payload)
    return jsonify({"message": "Not found"}), 404


@app.delete("/api/logs/<log_id>")
def delete_log(log_id: str):
    logs = load_logs()
    new_logs = [l for l in logs if l.get("id") != log_id]
    if len(new_logs) == len(logs):
        return jsonify({"message": "Not found"}), 404
    save_logs(new_logs)
    return jsonify({"ok": True})


@app.get("/api/stats")
def stats():
    logs = load_logs()
    total = len(logs)
    complete = sum(1 for l in logs if l.get("progress") == "complete")
    pct = int(round((complete / total) * 100)) if total else 0

    by_type: Dict[str, int] = {}
    for l in logs:
        t = str(l.get("climbType", "unknown"))
        by_type[t] = by_type.get(t, 0) + 1

    return jsonify({
        "total": total,
        "completionRate": pct,
        "byType": by_type,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
