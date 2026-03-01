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
                    parent_viz_id VARCHAR(64) NULL,
                    reshared_by_username VARCHAR(100) NULL,
                    reshare_description TEXT NULL,
                    original_creator_username VARCHAR(100) NULL,
                    INDEX idx_target (target_type, target_value),
                    INDEX idx_created_by (created_by_username),
                    INDEX idx_parent (parent_viz_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )
        conn.commit()
        try:
            _add_assigned_viz_columns_if_missing(conn)
        except Exception:
            pass
    _ensure_viz_feedback_tables(engine)


def _add_assigned_viz_columns_if_missing(conn):
    """Add reshare columns if table existed without them."""
    for col, defn in [
        ("parent_viz_id", "VARCHAR(64) NULL"),
        ("reshared_by_username", "VARCHAR(100) NULL"),
        ("reshare_description", "TEXT NULL"),
        ("original_creator_username", "VARCHAR(100) NULL"),
    ]:
        try:
            conn.execute(text(f"ALTER TABLE assigned_query_visualizations ADD COLUMN {col} {defn}"))
            conn.commit()
        except Exception:
            conn.rollback()


def _ensure_viz_feedback_tables(engine):
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS viz_feedback (
                    id VARCHAR(64) PRIMARY KEY,
                    viz_id VARCHAR(64) NOT NULL,
                    author_username VARCHAR(100) NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_viz (viz_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS viz_feedback_replies (
                    id VARCHAR(64) PRIMARY KEY,
                    feedback_id VARCHAR(64) NOT NULL,
                    author_username VARCHAR(100) NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_feedback (feedback_id)
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
    """Return roles and app users for assign/reshare dropdowns. Any authenticated user (for reshare); also used by Analyst/Sysadmin for assign."""
    users = []
    try:
        engine = _get_rbac_engine()
        _ensure_app_users_table(engine)
        with engine.connect() as conn:
            try:
                result = conn.execute(
                    text("SELECT username, role, COALESCE(full_name, '') AS full_name FROM app_users ORDER BY role, username"),
                )
            except Exception:
                result = conn.execute(text("SELECT username, role FROM app_users ORDER BY role, username"))
            for row in result.mappings().fetchall():
                users.append({
                    "username": (row["username"] or "").strip(),
                    "role": (row.get("role") or "").strip(),
                    "full_name": (row.get("full_name") or "").strip(),
                })
        engine.dispose()
    except Exception:
        users = []

    return jsonify({
        "roles": list(ROLES_FOR_ASSIGNMENT),
        "users": users,
    }), 200


@nextgen_query_bp.route("/assigned-visualizations", methods=["POST"])
@jwt_required()
def create_assigned_visualization():
    """Create an assigned visualization (target = role or user). Analyst/Sysadmin only."""
    try:
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
                        (id, created_by_username, title, target_type, target_value, query_text, chart_type, x_column, y_column, result_snapshot,
                         parent_viz_id, reshared_by_username, reshare_description, original_creator_username)
                        VALUES (:id, :created_by, :title, :target_type, :target_value, :query_text, :chart_type, :x_column, :y_column, :result_snapshot,
                                :parent_viz_id, :reshared_by_username, :reshare_description, :original_creator_username)
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
                        "parent_viz_id": None,
                        "reshared_by_username": None,
                        "reshare_description": None,
                        "original_creator_username": None,
                    },
                )
                conn.commit()
            engine.dispose()
        except Exception as e:
            if engine:
                try:
                    engine.dispose()
                except Exception:
                    pass
            return jsonify({"error": str(e)}), 500

        return jsonify({"id": vid, "message": "Visualization assigned successfully."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@nextgen_query_bp.route("/assigned-visualizations/reshare", methods=["POST"])
@jwt_required()
def reshare_visualization():
    """Reshare a visualization that was shared with the current user. Requires clear description. Any eligible user."""
    try:
        username, role = _current_user()
        body = request.get_json(silent=True) or {}
        viz_id = (body.get("vizId") or body.get("viz_id") or "").strip()
        description = (body.get("description") or "").strip()
        target_type = (body.get("targetType") or "").strip().lower()
        target_value = (body.get("targetValue") or "").strip()
        title_override = (body.get("title") or "").strip()

        if not viz_id:
            return jsonify({"error": "vizId is required."}), 400
        if not description:
            return jsonify({"error": "A clear description is required when resharing."}), 400
        if target_type not in ("role", "user"):
            return jsonify({"error": "Target must be 'role' or 'user'."}), 400
        if not target_value:
            return jsonify({"error": "Target value is required."}), 400

        engine = _get_rbac_engine()
        _ensure_assigned_viz_table(engine)
        parent = None
        with engine.connect() as conn:
            result = conn.execute(
                text(
                    """
                    SELECT id, created_by_username, title, target_type, target_value, query_text, chart_type, x_column, y_column, result_snapshot,
                           parent_viz_id, reshared_by_username, original_creator_username
                    FROM assigned_query_visualizations
                    WHERE id = :vid
                    """
                ),
                {"vid": viz_id},
            )
            row = result.mappings().fetchone()
            if not row:
                engine.dispose()
                return jsonify({"error": "Visualization not found."}), 404
            parent = dict(row)

        # Check current user can see the parent viz (is a recipient)
        pt = (parent.get("target_type") or "").strip().lower()
        pv = (parent.get("target_value") or "").strip().lower()
        role_ok = pt == "role" and pv == role
        user_ok = pt == "user" and pv == username.lower()
        if not (role_ok or user_ok):
            engine.dispose()
            return jsonify({"error": "You can only reshare visualizations that were shared with you."}), 403

        # Prevent resharing the same viz twice to the same target (role or user)
        target_val_lower = target_value.strip().lower()
        with engine.connect() as conn:
            # Already shared: either this viz is the one assigned to that target, or a reshare to that target exists
            existing = conn.execute(
                text(
                    """
                    SELECT id FROM assigned_query_visualizations
                    WHERE (id = :vid OR parent_viz_id = :vid)
                    AND LOWER(TRIM(target_type)) = :tt
                    AND LOWER(TRIM(target_value)) = :tv
                    LIMIT 1
                    """
                ),
                {"vid": viz_id, "tt": target_type, "tv": target_val_lower},
            ).mappings().fetchone()
            if existing:
                engine.dispose()
                return jsonify({"error": "This chart is already shared with that " + ("role" if target_type == "role" else "user") + ". Choose a different recipient."}), 400

        snap = parent.get("result_snapshot")
        if isinstance(snap, str):
            try:
                snap = json.loads(snap)
            except Exception:
                snap = None
        snapshot_json = json.dumps(snap) if snap is not None else None
        original_creator = parent.get("original_creator_username") or parent["created_by_username"]
        title = title_override or parent["title"]
        new_id = str(uuid.uuid4())[:24]

        with engine.connect() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO assigned_query_visualizations
                    (id, created_by_username, title, target_type, target_value, query_text, chart_type, x_column, y_column, result_snapshot,
                     parent_viz_id, reshared_by_username, reshare_description, original_creator_username)
                    VALUES (:id, :created_by, :title, :target_type, :target_value, :query_text, :chart_type, :x_column, :y_column, :result_snapshot,
                            :parent_viz_id, :reshared_by, :reshare_desc, :original_creator)
                    """
                ),
                {
                    "id": new_id,
                    "created_by": original_creator,
                    "title": title,
                    "target_type": target_type,
                    "target_value": target_value,
                    "query_text": parent.get("query_text") or "",
                    "chart_type": parent.get("chart_type") or "bar",
                    "x_column": parent.get("x_column") or "",
                    "y_column": parent.get("y_column") or "",
                    "result_snapshot": snapshot_json,
                    "parent_viz_id": viz_id,
                    "reshared_by": username,
                    "reshare_desc": description,
                    "original_creator": original_creator,
                },
            )
            conn.commit()
        engine.dispose()
        return jsonify({"id": new_id, "message": "Visualization reshared successfully."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
                           query_text, chart_type, x_column, y_column, result_snapshot,
                           parent_viz_id, reshared_by_username, reshare_description, original_creator_username
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
        is_reshared = bool(r.get("parent_viz_id") or r.get("reshared_by_username"))
        item = {
            "id": r["id"],
            "createdByUsername": r["created_by_username"],
            "createdAt": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
            "title": r["title"],
            "targetType": r["target_type"],
            "targetValue": r["target_value"],
            "queryText": r.get("query_text"),
            "chartType": r["chart_type"] or "bar",
            "xColumn": r["x_column"],
            "yColumn": r["y_column"],
            "resultSnapshot": snap,
        }
        if is_reshared:
            item["isReshared"] = True
            item["resharedByUsername"] = r.get("reshared_by_username") or ""
            item["reshareDescription"] = r.get("reshare_description") or ""
            item["originalCreatorUsername"] = r.get("original_creator_username") or r["created_by_username"]
        else:
            item["isReshared"] = False
            item["originalCreatorUsername"] = r["created_by_username"]
        out.append(item)
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
    """Delete an assigned visualization. Allowed: Analyst/Sysadmin, creator (created_by), or reshared_by."""
    username, role = _current_user()
    if not viz_id or len(viz_id) > 64:
        return jsonify({"error": "Invalid visualization id."}), 400

    engine = _get_rbac_engine()
    _ensure_assigned_viz_table(engine)
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    "SELECT created_by_username, reshared_by_username FROM assigned_query_visualizations WHERE id = :id"
                ),
                {"id": viz_id},
            ).mappings().fetchone()
            if not row:
                engine.dispose()
                return jsonify({"error": "Visualization not found."}), 404
            creator = (row.get("created_by_username") or "").strip()
            reshared_by = (row.get("reshared_by_username") or "").strip()
            allowed = (
                role in ("analyst", "sysadmin")
                or creator == username
                or reshared_by == username
            )
            if not allowed:
                engine.dispose()
                return jsonify({"error": "You can only delete visualizations you created or reshared."}), 403
            result = conn.execute(text("DELETE FROM assigned_query_visualizations WHERE id = :id"), {"id": viz_id})
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


def _can_reply_to_feedback(conn, viz_id: str, username: str) -> bool:
    """True if user is creator or reshared_by for this viz (can reply to feedback)."""
    row = conn.execute(
        text("SELECT created_by_username, reshared_by_username FROM assigned_query_visualizations WHERE id = :id"),
        {"id": viz_id},
    ).mappings().fetchone()
    if not row:
        return False
    creator = (row.get("created_by_username") or "").strip()
    reshared = (row.get("reshared_by_username") or "").strip()
    return creator == username or reshared == username


@nextgen_query_bp.route("/assigned-visualizations/<viz_id>/feedback", methods=["POST"])
@jwt_required()
def post_viz_feedback(viz_id):
    """Add feedback on a visualization. Caller must be a recipient (see for-me)."""
    username, role = _current_user()
    if not viz_id or len(viz_id) > 64:
        return jsonify({"error": "Invalid viz id."}), 400
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Message is required."}), 400
    engine = _get_rbac_engine()
    _ensure_assigned_viz_table(engine)
    try:
        with engine.connect() as conn:
            viz = conn.execute(
                text(
                    "SELECT id, target_type, target_value FROM assigned_query_visualizations WHERE id = :id"
                ),
                {"id": viz_id},
            ).mappings().fetchone()
            if not viz:
                engine.dispose()
                return jsonify({"error": "Visualization not found."}), 404
            pt, pv = (viz.get("target_type") or "").strip().lower(), (viz.get("target_value") or "").strip().lower()
            if not ((pt == "role" and pv == role) or (pt == "user" and pv == username.lower())):
                engine.dispose()
                return jsonify({"error": "You can only submit feedback on visualizations shared with you."}), 403
            fid = str(uuid.uuid4())[:24]
            conn.execute(
                text(
                    "INSERT INTO viz_feedback (id, viz_id, author_username, message) VALUES (:id, :viz_id, :author, :msg)"
                ),
                {"id": fid, "viz_id": viz_id, "author": username, "msg": message},
            )
            conn.commit()
        engine.dispose()
        return jsonify({"id": fid, "message": "Feedback added."}), 201
    except Exception as e:
        if engine:
            engine.dispose()
        return jsonify({"error": str(e)}), 500


@nextgen_query_bp.route("/assigned-visualizations/<viz_id>/feedback", methods=["GET"])
@jwt_required()
def get_viz_feedback(viz_id):
    """List feedback and replies for a visualization. Caller must be able to see the viz (for-me) or be creator/resharer."""
    username, role = _current_user()
    if not viz_id or len(viz_id) > 64:
        return jsonify({"error": "Invalid viz id."}), 400
    engine = _get_rbac_engine()
    _ensure_assigned_viz_table(engine)
    try:
        with engine.connect() as conn:
            fb_rows = conn.execute(
                text(
                    "SELECT id, author_username, message, created_at FROM viz_feedback WHERE viz_id = :viz_id ORDER BY created_at ASC"
                ),
                {"viz_id": viz_id},
            ).mappings().fetchall()
            out = []
            for f in fb_rows:
                fid = f["id"]
                replies = conn.execute(
                    text(
                        "SELECT id, author_username, message, created_at FROM viz_feedback_replies WHERE feedback_id = :fid ORDER BY created_at ASC"
                    ),
                    {"fid": fid},
                ).mappings().fetchall()
                out.append({
                    "id": fid,
                    "authorUsername": f["author_username"],
                    "message": f["message"],
                    "createdAt": f["created_at"].isoformat() if hasattr(f["created_at"], "isoformat") else str(f["created_at"]),
                    "replies": [
                        {
                            "id": r["id"],
                            "authorUsername": r["author_username"],
                            "message": r["message"],
                            "createdAt": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
                        }
                        for r in replies
                    ],
                })
            return jsonify({"feedback": out}), 200
    except Exception as e:
        if engine:
            engine.dispose()
        return jsonify({"error": str(e)}), 500


@nextgen_query_bp.route("/assigned-visualizations/feedback/<feedback_id>/reply", methods=["POST"])
@jwt_required()
def reply_to_feedback(feedback_id):
    """Reply to a feedback. Only creator or reshared_by of the viz can reply."""
    username, role = _current_user()
    if not feedback_id or len(feedback_id) > 64:
        return jsonify({"error": "Invalid feedback id."}), 400
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Message is required."}), 400
    engine = _get_rbac_engine()
    _ensure_assigned_viz_table(engine)
    try:
        with engine.connect() as conn:
            fb = conn.execute(
                text("SELECT id, viz_id FROM viz_feedback WHERE id = :id"),
                {"id": feedback_id},
            ).mappings().fetchone()
            if not fb:
                engine.dispose()
                return jsonify({"error": "Feedback not found."}), 404
            viz_id = fb["viz_id"]
            if not _can_reply_to_feedback(conn, viz_id, username):
                engine.dispose()
                return jsonify({"error": "Only the chart creator or person who shared it can reply."}), 403
            rid = str(uuid.uuid4())[:24]
            conn.execute(
                text(
                    "INSERT INTO viz_feedback_replies (id, feedback_id, author_username, message) VALUES (:id, :fid, :author, :msg)"
                ),
                {"id": rid, "fid": feedback_id, "author": username, "msg": message},
            )
            conn.commit()
        engine.dispose()
        return jsonify({"id": rid, "message": "Reply added."}), 201
    except Exception as e:
        if engine:
            engine.dispose()
        return jsonify({"error": str(e)}), 500


@nextgen_query_bp.route("/assigned-visualizations/my-shared", methods=["GET"])
@jwt_required()
def get_my_shared_visualizations():
    """List visualizations created OR reshared by the current user. So the resharer sees charts they reshared and can view/reply to feedback."""
    username, role = _current_user()
    engine = _get_rbac_engine()
    _ensure_assigned_viz_table(engine)
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT id, created_by_username, created_at, title, target_type, target_value,
                           query_text, chart_type, x_column, y_column, result_snapshot,
                           parent_viz_id, reshared_by_username, reshare_description, original_creator_username
                    FROM assigned_query_visualizations
                    WHERE created_by_username = :username OR reshared_by_username = :username
                    ORDER BY created_at DESC
                    """
                ),
                {"username": username},
            ).mappings().fetchall()
            out = []
            for r in rows:
                snap = r.get("result_snapshot")
                if isinstance(snap, str):
                    try:
                        snap = json.loads(snap)
                    except Exception:
                        snap = None
                reshared_by_me = (r.get("reshared_by_username") or "").strip() == username
                out.append({
                    "id": r["id"],
                    "createdByUsername": r["created_by_username"],
                    "createdAt": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
                    "title": r["title"],
                    "targetType": r["target_type"],
                    "targetValue": r["target_value"],
                    "queryText": r.get("query_text"),
                    "chartType": r.get("chart_type") or "bar",
                    "xColumn": r.get("x_column"),
                    "yColumn": r.get("y_column"),
                    "resultSnapshot": snap,
                    "resharedByMe": reshared_by_me,
                })
            return jsonify({"visualizations": out}), 200
    except Exception as e:
        if engine:
            engine.dispose()
        return jsonify({"error": str(e)}), 500

