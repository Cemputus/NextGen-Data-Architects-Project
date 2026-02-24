"""
NextGen Query API
Advanced SQL workspace for analysts.

NOTE: This endpoint trusts analyst users and does not restrict statements
to read-only. Use with care in production.
"""
import time
from typing import List, Dict, Any

import pandas as pd
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import create_engine, text

from config import DATA_WAREHOUSE_CONN_STRING

nextgen_query_bp = Blueprint("nextgen_query", __name__, url_prefix="/api/query")


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
    if is_select_like and " limit " not in lower:
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

