"""
NextGen Query API
Advanced SQL workspace for analysts.
Assigned visualizations: analysts can assign a visualization to a role or app user.
"""
import time
import re
import json
import uuid
from typing import List, Dict, Any, Optional

import pandas as pd
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import create_engine, text

from config import DATA_WAREHOUSE_CONN_STRING
from api.auth import _ensure_ucu_rbac_database, _ensure_app_users_table, RBAC_DB_NAME

nextgen_query_bp = Blueprint("nextgen_query", __name__, url_prefix="/api/query")


def _get_rbac_engine():
    _ensure_ucu_rbac_database()
    conn_str = DATA_WAREHOUSE_CONN_STRING.replace("UCU_DataWarehouse", RBAC_DB_NAME)
    return create_engine(conn_str)


def _ensure_assigned_viz_table(engine):
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS assigned_query_visualizations (
                    id VARCHAR(64) PRIMARY KEY,
                    created_by_username VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    title VARCHAR(200) NOT NULL,
                    target_type VARCHAR(20) NOT NULL,
                    target_value VARCHAR(100) NOT NULL,
                    query_text MEDIUMTEXT,
                    chart_type VARCHAR(20),
                    x_column VARCHAR(100),
                    y_column VARCHAR(100),
                    result_snapshot JSON,
                    INDEX idx_target (target_type, target_value),
                    INDEX idx_created_by (created_by_username)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )
        conn.commit()


def _build_response_frame(df: pd.DataFrame) -> Dict[str, Any]:
    """Convert DataFrame to JSON-friendly structure with column metadata."""
    if df is None:
        return {"columns": [], "rows": [], "row_count": 0}

    columns_meta: List[Dict[str, Any]] = []
    for name, dtype in zip(df.columns, df.dtypes):
        is_numeric = bool(pd.api.types.is_numeric_dtype(dtype))
        columns_meta.append(
            {
                "name": str(name),
                "type": str(dtype),
                "is_numeric": is_numeric,
            }
        )

    rows = df.to_dict(orient="records")
    return {
        "columns": columns_meta,
        "rows": rows,
        "row_count": len(rows),
    }


@nextgen_query_bp.route("/execute", methods=["POST"])
@jwt_required()
def execute_query():
    """
    Execute an arbitrary SQL query against the data warehouse for analyst users.

    Security:
    - Analyst role only (enforced via JWT)
    - No SQL keyword blocking; analysts are trusted.
    - For SELECT/WITH statements, a configurable LIMIT is added if none is present
      to minimize runaway result sets.
    """
    claims = get_jwt()
    role = (claims.get("role") or "").strip().lower()
    if role != "analyst":
        return jsonify({"error": "Permission denied. Analyst role required for NextGen Query."}), 403

    payload = request.get_json(silent=True) or {}
    raw_sql = (payload.get("query") or "").strip()
    if not raw_sql:
        return jsonify({"error": "Query text is required."}), 400

    max_rows = payload.get("max_rows") or 1000
    try:
        max_rows = int(max_rows)
    except (TypeError, ValueError):
        max_rows = 1000
    max_rows = max(1, min(max_rows, 5000))

    normalized = raw_sql.strip().rstrip(";")
    lower = normalized.lower()
    first_token = lower.split(None, 1)[0] if lower else ""
    is_select_like = first_token in ("select", "with")

    safe_sql = normalized
    # If user did not specify a LIMIT on a read query, append one to minimize errors
    if is_select_like and not re.search(r"\blimit\b", lower):
        safe_sql = f"{normalized} LIMIT {max_rows}"

    engine = None
    start = time.time()
    try:
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        with engine.connect() as conn:
            # Best-effort server-side timeout for MySQL (ignore failure for other engines)
            try:
                conn.execute(text("SET SESSION max_execution_time = 8000"))
            except Exception:
                pass

            if is_select_like:
                # Return tabular results
                df = pd.read_sql_query(text(safe_sql), conn)
                rows_affected = None
            else:
                # Non-SELECT statement: execute and return metadata only
                result_obj = conn.execute(text(safe_sql))
                try:
                    conn.commit()
                except Exception:
                    # Some drivers autocommit; ignore commit errors
                    pass
                df = None
                rows_affected = getattr(result_obj, "rowcount", None)
    except Exception as e:
        if engine is not None:
            engine.dispose()
        return jsonify({"error": str(e)}), 400
    finally:
        elapsed = int((time.time() - start) * 1000)
        if engine is not None:
            engine.dispose()

    frame = _build_response_frame(df)
    frame["elapsed_ms"] = elapsed
    if not is_select_like:
        frame["message"] = f"Statement executed successfully (rows affected: {rows_affected})."

    return jsonify(frame), 200


def _current_user():
    claims = get_jwt()
    username = (claims.get("username") or claims.get("access_number") or "").strip()
    role = (claims.get("role") or "").strip().lower()
    return username, role


def _require_analyst_or_sysadmin(role: str):
    if role not in ("analyst", "sysadmin"):
        return jsonify({"error": "Permission denied. Only Analyst or Sysadmin can assign visualizations."}), 403
    return None


ROLES_FOR_ASSIGNMENT = [
    "Student", "Staff", "HOD", "Dean", "Senate", "Finance", "HR", "Analyst", "Sysadmin",
]


@nextgen_query_bp.route("/assigned-visualizations/target-options", methods=["GET"])
@jwt_required()
def get_assignment_target_options():
    """Return roles and app users for the assign-visualization dropdown. Analyst/Sysadmin only."""
    username, role = _current_user()
    err = _require_analyst_or_sysadmin(role)
    if err is not None:
        return err

    users = []
    try:
        engine = _get_rbac_engine()
        _ensure_app_users_table(engine)
        with engine.connect() as conn:
            # Include full_name for display and search; order by role then username so frontend can group
            result = conn.execute(
                text("""
                    SELECT username, role, COALESCE(full_name, '') AS full_name
                    FROM app_users
                    ORDER BY role, username
                """),
            )
            for row in result.mappings().fetchall():
                users.append({
                    "username": (row["username"] or "").strip(),
                    "role": (row.get("role") or "").strip(),
                    "full_name": (row.get("full_name") or "").strip(),
                })
        engine.dispose()
    except Exception:
        pass

    return jsonify({
        "roles": list(ROLES_FOR_ASSIGNMENT),
        "users": users,
    }), 200


@nextgen_query_bp.route("/assigned-visualizations", methods=["POST"])
@jwt_required()
def create_assigned_visualization():
    """Create an assigned visualization (target = role or user). Analyst/Sysadmin only."""
    username, role = _current_user()
    err = _require_analyst_or_sysadmin(role)
    if err is not None:
        return err

    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    target_type = (body.get("targetType") or "").strip().lower()
    target_value = (body.get("targetValue") or "").strip()
    query_text = (body.get("query") or "").strip()
    chart_type = (body.get("chartType") or "bar").strip()
    x_column = (body.get("xColumn") or "").strip()
    y_column = (body.get("yColumn") or "").strip()
    result_snapshot = body.get("resultSnapshot")

    if not title:
        return jsonify({"error": "Title is required."}), 400
    if target_type not in ("role", "user"):
        return jsonify({"error": "Target must be 'role' or 'user'."}), 400
    if not target_value:
        return jsonify({"error": "Target value is required (role name or username)."}), 400
    if not query_text:
        return jsonify({"error": "Query text is required."}), 400

    vid = str(uuid.uuid4())[:24]
    snapshot_json = None
    if result_snapshot is not None:
        try:
            snapshot_json = json.dumps(result_snapshot)
        except Exception:
            pass

    engine = _get_rbac_engine()
    _ensure_assigned_viz_table(engine)
    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO assigned_query_visualizations
                    (id, created_by_username, title, target_type, target_value, query_text, chart_type, x_column, y_column, result_snapshot)
                    VALUES (:id, :created_by, :title, :target_type, :target_value, :query_text, :chart_type, :x_column, :y_column, :result_snapshot)
                    """
                ),
                {
                    "id": vid,
                    "created_by": username,
                    "title": title,
                    "target_type": target_type,
                    "target_value": target_value,
                    "query_text": query_text,
                    "chart_type": chart_type,
                    "x_column": x_column,
                    "y_column": y_column,
                    "result_snapshot": snapshot_json,
                },
            )
            conn.commit()
        engine.dispose()
    except Exception as e:
        if engine:
            engine.dispose()
        return jsonify({"error": str(e)}), 500

    return jsonify({"id": vid, "message": "Visualization assigned successfully."}), 201


@nextgen_query_bp.route("/assigned-visualizations/for-me", methods=["GET"])
@jwt_required()
def get_assigned_visualizations_for_me():
    """Return visualizations assigned to the current user's role or to the current user (username)."""
    username, role = _current_user()
    engine = _get_rbac_engine()
    _ensure_assigned_viz_table(engine)
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text(
                    """
                    SELECT id, created_by_username, created_at, title, target_type, target_value,
                           query_text, chart_type, x_column, y_column, result_snapshot
                    FROM assigned_query_visualizations
                    WHERE (target_type = 'role' AND LOWER(TRIM(target_value)) = :role)
                       OR (target_type = 'user' AND LOWER(TRIM(target_value)) = :username)
                    ORDER BY created_at DESC
                    """
                ),
                {"role": role, "username": username.lower()},
            )
            rows = result.mappings().fetchall()
        engine.dispose()
    except Exception as e:
        if engine:
            engine.dispose()
        return jsonify({"error": str(e), "visualizations": []}), 500

    out = []
    for r in rows:
        snap = r.get("result_snapshot")
        if isinstance(snap, str):
            try:
                snap = json.loads(snap)
            except Exception:
                snap = None
        out.append({
            "id": r["id"],
            "createdByUsername": r["created_by_username"],
            "createdAt": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
            "title": r["title"],
            "targetType": r["target_type"],
            "targetValue": r["target_value"],
            "queryText": r["query_text"],
            "chartType": r["chart_type"] or "bar",
            "xColumn": r["x_column"],
            "yColumn": r["y_column"],
            "resultSnapshot": snap,
        })
    return jsonify({"visualizations": out}), 200


@nextgen_query_bp.route("/assigned-visualizations", methods=["GET"])
@jwt_required()
def list_assigned_visualizations():
    """List assigned visualizations (analyst/sysadmin). Optional ?created_by=me to filter by current user."""
    username, role = _current_user()
    err = _require_analyst_or_sysadmin(role)
    if err is not None:
        return err

    created_by_me = request.args.get("created_by", "").strip().lower() == "me"
    engine = _get_rbac_engine()
    _ensure_assigned_viz_table(engine)
    try:
        with engine.connect() as conn:
            if created_by_me:
                result = conn.execute(
                    text(
                        """
                        SELECT id, created_by_username, created_at, title, target_type, target_value,
                               chart_type, x_column, y_column
                        FROM assigned_query_visualizations
                        WHERE created_by_username = :username
                        ORDER BY created_at DESC
                        """
                    ),
                    {"username": username},
                )
            else:
                result = conn.execute(
                    text(
                        """
                        SELECT id, created_by_username, created_at, title, target_type, target_value,
                               chart_type, x_column, y_column
                        FROM assigned_query_visualizations
                        ORDER BY created_at DESC
                        """
                    ),
                )
            rows = result.mappings().fetchall()
        engine.dispose()
    except Exception as e:
        if engine:
            engine.dispose()
        return jsonify({"error": str(e), "visualizations": []}), 500

    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "createdByUsername": r["created_by_username"],
            "createdAt": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
            "title": r["title"],
            "targetType": r["target_type"],
            "targetValue": r["target_value"],
            "chartType": r.get("chart_type") or "bar",
            "xColumn": r.get("x_column"),
            "yColumn": r.get("y_column"),
        })
    return jsonify({"visualizations": out}), 200


@nextgen_query_bp.route("/assigned-visualizations/<viz_id>", methods=["DELETE"])
@jwt_required()
def delete_assigned_visualization(viz_id):
    """Delete an assigned visualization. Analyst/Sysadmin or creator only."""
    username, role = _current_user()
    err = _require_analyst_or_sysadmin(role)
    if err is not None:
        return err

    if not viz_id or len(viz_id) > 64:
        return jsonify({"error": "Invalid visualization id."}), 400

    engine = _get_rbac_engine()
    _ensure_assigned_viz_table(engine)
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("DELETE FROM assigned_query_visualizations WHERE id = :id"),
                {"id": viz_id},
            )
            conn.commit()
            deleted = result.rowcount
        engine.dispose()
    except Exception as e:
        if engine:
            engine.dispose()
        return jsonify({"error": str(e)}), 500

    if deleted == 0:
        return jsonify({"error": "Visualization not found."}), 404
    return jsonify({"message": "Visualization removed."}), 200

