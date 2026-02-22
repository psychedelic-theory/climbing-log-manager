from __future__ import annotations

import json
import os
import uuid
from datetime import date as Date
from typing import Any, Dict, List, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ----------------------------
# Paths (seed file lives in repo)
# ----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
SEED_PATH = os.path.join(DATA_DIR, "seed.json")

PAGE_SIZE_DEFAULT = 10
PAGE_SIZE_MAX = 50


# ----------------------------
# Helpers
# ----------------------------
def _parse_csv(arg: Optional[str]) -> List[str]:
    if not arg:
        return []
    return [x.strip() for x in arg.split(",") if x.strip()]


def _yds_key(g: str) -> int:
    """
    Map YDS grades like "5.2".."5.15" to integers 502..515
    """
    try:
        s = g.strip().lower()
        if not s.startswith("5."):
            return -1
        num = s.split("5.", 1)[1]
        num = "".join(ch for ch in num if ch.isdigit())
        return 500 + int(num)
    except Exception:
        return -1


def _v_key(g: str) -> int:
    """
    Map V grades like "V0".."V17" to integers 0..17
    """
    try:
        s = g.strip().upper()
        if not s.startswith("V"):
            return -1
        return int(s[1:])
    except Exception:
        return -1


def _grade_key(grade_system: str, grade: str) -> int:
    if grade_system == "YDS":
        return _yds_key(grade)
    if grade_system == "V":
        return _v_key(grade)
    return -1


def get_db_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is not set. Add it in Render Environment Variables.")
    return url


def get_conn():
    # Render provides a Postgres URL; psycopg2 can connect directly with it.
    return psycopg2.connect(get_db_url(), cursor_factory=RealDictCursor)


def init_db() -> None:
    create_sql = """
    CREATE TABLE IF NOT EXISTS climb_logs (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL,
      environment TEXT NOT NULL,
      location TEXT NOT NULL,
      route_name TEXT NOT NULL,
      climb_type TEXT NOT NULL,
      grade_system TEXT NOT NULL,
      grade TEXT NOT NULL,
      grade_key INTEGER NOT NULL,
      progress TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(create_sql)


def seed_db_if_empty() -> None:
    """
    If DB table is empty, load seed.json and insert.
    """
    if not os.path.exists(SEED_PATH):
        return

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM climb_logs;")
            n = int(cur.fetchone()["n"])
            if n > 0:
                return

            with open(SEED_PATH, "r", encoding="utf-8") as f:
                seed = json.load(f)

            if not isinstance(seed, list) or len(seed) == 0:
                return

            insert_sql = """
            INSERT INTO climb_logs
              (id, date, environment, location, route_name, climb_type, grade_system, grade, grade_key, progress)
            VALUES
              (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING;
            """

            rows = []
            for item in seed:
                _id = str(item.get("id") or uuid.uuid4())
                date_str = str(item.get("date", "")).strip()
                env = str(item.get("environment", "")).strip()
                loc = str(item.get("location", "")).strip()
                route = str(item.get("routeName", "")).strip()
                ctype = str(item.get("climbType", "")).strip()
                gsys = str(item.get("gradeSystem", "")).strip()
                grade = str(item.get("grade", "")).strip()
                prog = str(item.get("progress", "")).strip()

                gk = _grade_key(gsys, grade)

                rows.append((_id, date_str, env, loc, route, ctype, gsys, grade, gk, prog))

            cur.executemany(insert_sql, rows)


def validate_payload(payload: Dict[str, Any]) -> Dict[str, str]:
    errors: Dict[str, str] = {}

    required = ["date", "environment", "location", "routeName", "climbType", "gradeSystem", "grade", "progress"]
    for field in required:
        if not str(payload.get(field, "")).strip():
            errors[field] = f"{field} is required."

    date_str = str(payload.get("date", "")).strip()
    if date_str:
        try:
            y, m, d = map(int, date_str.split("-"))
            dt = Date(y, m, d)
            if dt > Date.today():
                errors["date"] = "Date cannot be in the future."
        except Exception:
            errors["date"] = "Date must be YYYY-MM-DD."

    env = payload.get("environment")
    if env and env not in ("gym", "outdoor"):
        errors["environment"] = "Environment must be gym or outdoor."

    ctype = payload.get("climbType")
    if ctype and ctype not in ("top-rope", "sport", "trad", "boulder"):
        errors["climbType"] = "Invalid climb type."

    prog = payload.get("progress")
    if prog and prog not in ("complete", "incomplete"):
        errors["progress"] = "Progress must be complete or incomplete."

    gsys = payload.get("gradeSystem")
    grade = str(payload.get("grade", "")).strip()

    # Your domain rule: boulder -> V, roped -> YDS
    if ctype == "boulder":
        if gsys and gsys != "V":
            errors["gradeSystem"] = "Bouldering should use V-Scale."
        if gsys == "V" and grade:
            k = _v_key(grade)
            if k < 0 or k > 17:
                errors["grade"] = "Bouldering grades must be between V0 and V17."
    else:
        if gsys and gsys != "YDS":
            errors["gradeSystem"] = "Roped climbs should use YDS."
        if gsys == "YDS" and grade:
            k = _yds_key(grade)
            if k < 502 or k > 515:
                errors["grade"] = "Roped climb grades must be between 5.2 and 5.15."

    return errors


def to_api_row(db_row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert DB column names to your existing API field names
    """
    return {
        "id": db_row["id"],
        "date": str(db_row["date"]),
        "environment": db_row["environment"],
        "location": db_row["location"],
        "routeName": db_row["route_name"],
        "climbType": db_row["climb_type"],
        "gradeSystem": db_row["grade_system"],
        "grade": db_row["grade"],
        "progress": db_row["progress"],
    }


def build_where_clauses(
    q: str,
    envs: List[str],
    types: List[str],
    progress: List[str],
) -> Tuple[str, List[Any]]:
    clauses = []
    params: List[Any] = []

    if q:
        clauses.append("(route_name ILIKE %s OR location ILIKE %s)")
        like = f"%{q}%"
        params.extend([like, like])

    if envs:
        placeholders = ",".join(["%s"] * len(envs))
        clauses.append(f"environment IN ({placeholders})")
        params.extend(envs)

    if types:
        placeholders = ",".join(["%s"] * len(types))
        clauses.append(f"climb_type IN ({placeholders})")
        params.extend(types)

    if progress:
        placeholders = ",".join(["%s"] * len(progress))
        clauses.append(f"progress IN ({placeholders})")
        params.extend(progress)

    where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where_sql, params


def resolve_order_by(sort: str) -> str:
    """
    Allowlist sort options. Never put user input directly in SQL.
    """
    mapping = {
        "date_desc": "date DESC",
        "date_asc": "date ASC",
        "location_asc": "location ASC",
        "location_desc": "location DESC",
        "route_asc": "route_name ASC",
        "route_desc": "route_name DESC",
        # grade handled separately (requires grade system check)
    }
    return mapping.get(sort, "date DESC")


def should_allow_grade_sort(where_sql: str, params: List[Any]) -> Optional[str]:
    """
    Returns grade_system ("YDS" or "V") if filtered result set has exactly one system,
    otherwise returns None.
    """
    sql = f"SELECT DISTINCT grade_system FROM climb_logs {where_sql};"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            systems = [r["grade_system"] for r in cur.fetchall()]

    systems = [s for s in systems if s]
    if len(set(systems)) == 1:
        return systems[0]
    return None


# ----------------------------
# Startup: ensure table + seed
# ----------------------------
@app.before_request
def _ensure_db_ready():
    # Run once per instance (cheap guard)
    if not getattr(app, "_db_ready", False):
        init_db()
        seed_db_if_empty()
        app._db_ready = True


# ----------------------------
# Routes
# ----------------------------
@app.get("/")
def root():
    return jsonify({"health": "/api/health", "message": "Climbing Log API is running"})


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/logs")
def list_logs():
    page = int(request.args.get("page", "1"))
    page_size = int(request.args.get("pageSize", str(PAGE_SIZE_DEFAULT)))
    q = (request.args.get("q") or "").strip()

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

    where_sql, params = build_where_clauses(q.lower(), envs, types, progress)

    # Total count
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM climb_logs {where_sql};", params)
            total = int(cur.fetchone()["n"])

    # Sort logic
    order_by = "date DESC"
    if sort in ("grade_asc", "grade_desc"):
        sys = should_allow_grade_sort(where_sql, params)
        if sys in ("YDS", "V"):
            order_by = f"grade_key {'ASC' if sort == 'grade_asc' else 'DESC'}"
        else:
            order_by = "date DESC"
    else:
        order_by = resolve_order_by(sort)

    offset = (page - 1) * page_size

    sql = f"""
    SELECT id, date, environment, location, route_name, climb_type, grade_system, grade, progress
    FROM climb_logs
    {where_sql}
    ORDER BY {order_by}
    LIMIT %s OFFSET %s;
    """

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params + [page_size, offset])
            rows = cur.fetchall()

    items = [to_api_row(r) for r in rows]

    return jsonify({
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size
    })


@app.get("/api/logs/<log_id>")
def get_log(log_id: str):
    sql = """
    SELECT id, date, environment, location, route_name, climb_type, grade_system, grade, progress
    FROM climb_logs
    WHERE id = %s;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, [log_id])
            row = cur.fetchone()

    if not row:
        return jsonify({"message": "Not found"}), 404
    return jsonify(to_api_row(row))


@app.post("/api/logs")
def create_log():
    payload = request.get_json(force=True) or {}
    errors = validate_payload(payload)
    if errors:
        return jsonify({"errors": errors, "message": "Validation failed"}), 400

    new_id = str(uuid.uuid4())
    date_str = str(payload["date"]).strip()
    env = str(payload["environment"]).strip()
    loc = str(payload["location"]).strip()
    route = str(payload["routeName"]).strip()
    ctype = str(payload["climbType"]).strip()
    gsys = str(payload["gradeSystem"]).strip()
    grade = str(payload["grade"]).strip()
    prog = str(payload["progress"]).strip()

    gk = _grade_key(gsys, grade)

    insert_sql = """
    INSERT INTO climb_logs
      (id, date, environment, location, route_name, climb_type, grade_system, grade, grade_key, progress)
    VALUES
      (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, [new_id, date_str, env, loc, route, ctype, gsys, grade, gk, prog])

    return jsonify({
        "id": new_id,
        "date": date_str,
        "environment": env,
        "location": loc,
        "routeName": route,
        "climbType": ctype,
        "gradeSystem": gsys,
        "grade": grade,
        "progress": prog
    }), 201


@app.put("/api/logs/<log_id>")
def update_log(log_id: str):
    payload = request.get_json(force=True) or {}
    payload["id"] = log_id

    errors = validate_payload(payload)
    if errors:
        return jsonify({"errors": errors, "message": "Validation failed"}), 400

    date_str = str(payload["date"]).strip()
    env = str(payload["environment"]).strip()
    loc = str(payload["location"]).strip()
    route = str(payload["routeName"]).strip()
    ctype = str(payload["climbType"]).strip()
    gsys = str(payload["gradeSystem"]).strip()
    grade = str(payload["grade"]).strip()
    prog = str(payload["progress"]).strip()

    gk = _grade_key(gsys, grade)

    sql = """
    UPDATE climb_logs
    SET date=%s, environment=%s, location=%s, route_name=%s,
        climb_type=%s, grade_system=%s, grade=%s, grade_key=%s, progress=%s
    WHERE id=%s;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, [date_str, env, loc, route, ctype, gsys, grade, gk, prog, log_id])
            if cur.rowcount == 0:
                return jsonify({"message": "Not found"}), 404

    return jsonify({
        "id": log_id,
        "date": date_str,
        "environment": env,
        "location": loc,
        "routeName": route,
        "climbType": ctype,
        "gradeSystem": gsys,
        "grade": grade,
        "progress": prog
    })


@app.delete("/api/logs/<log_id>")
def delete_log(log_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM climb_logs WHERE id=%s;", [log_id])
            if cur.rowcount == 0:
                return jsonify({"message": "Not found"}), 404
    return jsonify({"ok": True})


@app.get("/api/stats")
def stats():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM climb_logs;")
            total = int(cur.fetchone()["total"])

            cur.execute("SELECT COUNT(*) AS complete FROM climb_logs WHERE progress='complete';")
            complete = int(cur.fetchone()["complete"])

            cur.execute("SELECT climb_type, COUNT(*) AS n FROM climb_logs GROUP BY climb_type ORDER BY climb_type;")
            by_type_rows = cur.fetchall()

    pct = int(round((complete / total) * 100)) if total else 0
    by_type = {r["climb_type"]: int(r["n"]) for r in by_type_rows}

    return jsonify({
        "total": total,
        "completionRate": pct,
        "byType": by_type,
    })


if __name__ == "__main__":
    # Local dev only. Render uses gunicorn.
    app.run(host="0.0.0.0", port=5000, debug=True)