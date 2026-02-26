"""
Dashboards API

Allows analysts (and optionally sysadmins) to create dashboards and assign
them to roles and/or specific users. Other roles can query dashboards that
are visible to them based on their role and username.
"""
import uuid
import json
from typing import List, Dict, Any

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import create_engine, text

from config import DATA_WAREHOUSE_CONN_STRING
from api.auth import _ensure_ucu_rbac_database, RBAC_DB_NAME


dashboards_bp = Blueprint("dashboards", __name__, url_prefix="/api/dashboards")


def _get_rbac_conn_string() -> str:
  return DATA_WAREHOUSE_CONN_STRING.replace("UCU_DataWarehouse", RBAC_DB_NAME)


def _ensure_dashboard_tables(engine):
  """Create dashboards + access tables in ucu_rbac if they don't exist."""
  try:
    with engine.connect() as conn:
      conn.execute(
        text(
          """
          CREATE TABLE IF NOT EXISTS dashboards (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            created_by_username VARCHAR(100) NOT NULL,
            created_by_role VARCHAR(50),
            definition LONGTEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_created_by (created_by_username),
            INDEX idx_active (is_active)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          """
        )
      )
      conn.execute(
        text(
          """
          CREATE TABLE IF NOT EXISTS dashboard_role_access (
            id INT AUTO_INCREMENT PRIMARY KEY,
            dashboard_id VARCHAR(64) NOT NULL,
            role_name VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_dash_role (dashboard_id, role_name),
            INDEX idx_role (role_name),
            FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          """
        )
      )
      conn.execute(
        text(
          """
          CREATE TABLE IF NOT EXISTS dashboard_user_access (
            id INT AUTO_INCREMENT PRIMARY KEY,
            dashboard_id VARCHAR(64) NOT NULL,
            username VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_dash_user (dashboard_id, username),
            INDEX idx_username (username),
            FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          """
        )
      )
      conn.commit()
  except Exception:
    # Any failure will be surfaced by the calling handler
    pass


def _get_engine():
  _ensure_ucu_rbac_database()
  engine = create_engine(_get_rbac_conn_string())
  _ensure_dashboard_tables(engine)
  return engine


def _current_user():
  claims = get_jwt()
  username = (claims.get("username") or claims.get("access_number") or "").strip()
  role = (claims.get("role") or "").strip().lower()
  return username, role


def _require_analyst_or_sysadmin(role: str):
  if role not in ("analyst", "sysadmin"):
    return jsonify({"error": "Permission denied. Only Analyst or Sysadmin can manage dashboards."}), 403
  return None


def _load_dashboards_for_user(engine, username: str, role: str) -> List[Dict[str, Any]]:
  """Return dashboards visible to given user/role."""
  with engine.connect() as conn:
    dashboards = []
    result = conn.execute(
      text(
        """
        SELECT DISTINCT d.*
        FROM dashboards d
        LEFT JOIN dashboard_role_access dra ON d.id = dra.dashboard_id
        LEFT JOIN dashboard_user_access dua ON d.id = dua.dashboard_id
        WHERE d.is_active = 1
          AND (
            dra.role_name = :role
            OR dua.username = :username
            OR d.created_by_username = :username
          )
        ORDER BY d.created_at DESC
        """
      ),
      {"role": role, "username": username},
    )
    for row in result.mappings():
      dashboards.append(dict(row))

    # Attach roles and users for each dashboard (simple per-dashboard queries to avoid complex IN binding)
    for d in dashboards:
      dash_id = d["id"]
      role_rows = conn.execute(
        text("SELECT role_name FROM dashboard_role_access WHERE dashboard_id = :id"),
        {"id": dash_id},
      ).scalars()
      user_rows = conn.execute(
        text("SELECT username FROM dashboard_user_access WHERE dashboard_id = :id"),
        {"id": dash_id},
      ).scalars()
      d["roles"] = [r for r in role_rows]
      d["users"] = [u for u in user_rows]
    return dashboards


@dashboards_bp.route("", methods=["GET"])
@jwt_required()
def list_dashboards():
  """
  Return dashboards visible to the current user based on role and username.

  Query params:
  - scope=all  (analyst/sysadmin only): return all dashboards in the system
  """
  username, role = _current_user()
  scope = (request.args.get("scope") or "").strip().lower()
  engine = None
  try:
    engine = _get_engine()
    with engine.connect() as conn:
      if scope == "all" and role in ("analyst", "sysadmin"):
        result = conn.execute(
          text(
            """
            SELECT d.*
            FROM dashboards d
            WHERE d.is_active = 1
            ORDER BY d.created_at DESC
            """
          )
        )
        dashboards = [dict(row) for row in result.mappings()]

        # Attach roles/users
        for d in dashboards:
          dash_id = d["id"]
          role_rows = conn.execute(
            text("SELECT role_name FROM dashboard_role_access WHERE dashboard_id = :id"),
            {"id": dash_id},
          ).scalars()
          user_rows = conn.execute(
            text("SELECT username FROM dashboard_user_access WHERE dashboard_id = :id"),
            {"id": dash_id},
          ).scalars()
          d["roles"] = [r for r in role_rows]
          d["users"] = [u for u in user_rows]
      else:
        dashboards = _load_dashboards_for_user(engine, username, role)
    return jsonify({"dashboards": dashboards}), 200
  except Exception as e:
    if engine is not None:
      engine.dispose()
    return jsonify({"error": str(e)}), 500


@dashboards_bp.route("", methods=["POST"])
@jwt_required()
def create_dashboard():
  """Create a new dashboard and assign it to roles/users. Analyst or Sysadmin only."""
  username, role = _current_user()
  err = _require_analyst_or_sysadmin(role)
  if err:
    return err

  data = request.get_json(silent=True) or {}
  name = (data.get("name") or "").strip()
  description = (data.get("description") or "").strip()
  definition = data.get("definition") or {}
  roles = data.get("roles") or []
  users = data.get("users") or []

  if not name:
    return jsonify({"error": "Dashboard name is required."}), 400

  # Normalize roles/usernames
  roles = list({(r or "").strip().lower() for r in roles if (r or "").strip()})
  users = list({(u or "").strip() for u in users if (u or "").strip()})

  dash_id = str(uuid.uuid4())
  engine = None
  try:
    engine = _get_engine()
    with engine.connect() as conn:
      conn = conn.execution_options(autocommit=False)
      conn.execute(
        text(
          """
          INSERT INTO dashboards (id, name, description, created_by_username, created_by_role, definition, is_active)
          VALUES (:id, :name, :description, :created_by, :created_role, :definition, 1)
          """
        ),
        {
          "id": dash_id,
          "name": name,
          "description": description,
          "created_by": username,
          "created_role": role,
          "definition": json.dumps(definition),
        },
      )

      for r in roles:
        conn.execute(
          text(
            """
            INSERT INTO dashboard_role_access (dashboard_id, role_name)
            VALUES (:dash_id, :role_name)
            ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)
            """
          ),
          {"dash_id": dash_id, "role_name": r},
        )
      for u in users:
        conn.execute(
          text(
            """
            INSERT INTO dashboard_user_access (dashboard_id, username)
            VALUES (:dash_id, :username)
            ON DUPLICATE KEY UPDATE username = VALUES(username)
            """
          ),
          {"dash_id": dash_id, "username": u},
        )
      conn.commit()

    # Reload full object (with roles/users) so response is consistent
    dashboards = _load_dashboards_for_user(engine, username, role)
    created = next((d for d in dashboards if d["id"] == dash_id), None)
    return jsonify({"dashboard": created}), 201
  except Exception as e:
    if engine is not None:
      engine.dispose()
    return jsonify({"error": str(e)}), 500


@dashboards_bp.route("/<dash_id>", methods=["PUT"])
@jwt_required()
def update_dashboard(dash_id):
  """Update dashboard metadata + role/user assignments. Analyst or Sysadmin only."""
  username, role = _current_user()
  err = _require_analyst_or_sysadmin(role)
  if err:
    return err

  data = request.get_json(silent=True) or {}
  name = (data.get("name") or "").strip()
  description = (data.get("description") or "").strip()
  definition = data.get("definition")
  roles = data.get("roles")
  users = data.get("users")

  if not name:
    return jsonify({"error": "Dashboard name is required."}), 400

  engine = None
  try:
    engine = _get_engine()
    with engine.connect() as conn:
      conn = conn.execution_options(autocommit=False)

      # Ensure dashboard exists and is visible to editor
      rows = conn.execute(
        text("SELECT id, created_by_username FROM dashboards WHERE id = :id AND is_active = 1"),
        {"id": dash_id},
      ).mappings()
      existing = next(iter(rows), None)
      if not existing:
        return jsonify({"error": "Dashboard not found."}), 404

      conn.execute(
        text(
          """
          UPDATE dashboards
          SET name = :name,
              description = :description,
              definition = :definition
          WHERE id = :id
          """
        ),
        {
          "id": dash_id,
          "name": name,
          "description": description,
          "definition": json.dumps(definition) if definition is not None else None,
        },
      )

      if roles is not None:
        roles_norm = list({(r or "").strip().lower() for r in roles if (r or "").strip()})
        conn.execute(text("DELETE FROM dashboard_role_access WHERE dashboard_id = :id"), {"id": dash_id})
        for r in roles_norm:
          conn.execute(
            text(
              """
              INSERT INTO dashboard_role_access (dashboard_id, role_name)
              VALUES (:dash_id, :role_name)
              """
            ),
            {"dash_id": dash_id, "role_name": r},
          )

      if users is not None:
        users_norm = list({(u or "").strip() for u in users if (u or "").strip()})
        conn.execute(text("DELETE FROM dashboard_user_access WHERE dashboard_id = :id"), {"id": dash_id})
        for u in users_norm:
          conn.execute(
            text(
              """
              INSERT INTO dashboard_user_access (dashboard_id, username)
              VALUES (:dash_id, :username)
              """
            ),
            {"dash_id": dash_id, "username": u},
          )

      conn.commit()

    dashboards = _load_dashboards_for_user(engine, username, role)
    updated = next((d for d in dashboards if d["id"] == dash_id), None)
    return jsonify({"dashboard": updated}), 200
  except Exception as e:
    if engine is not None:
      engine.dispose()
    return jsonify({"error": str(e)}), 500


@dashboards_bp.route("/<dash_id>", methods=["GET"])
@jwt_required()
def get_dashboard(dash_id):
  """Get a single dashboard if visible to the current user."""
  username, role = _current_user()
  engine = None
  try:
    engine = _get_engine()
    dashboards = _load_dashboards_for_user(engine, username, role)
    for d in dashboards:
      if d["id"] == dash_id:
        return jsonify({"dashboard": d}), 200
    return jsonify({"error": "Dashboard not found or access denied."}), 403
  except Exception as e:
    if engine is not None:
      engine.dispose()
    return jsonify({"error": str(e)}), 500


@dashboards_bp.route("/<dash_id>", methods=["DELETE"])
@jwt_required()
def delete_dashboard(dash_id):
  """Soft delete a dashboard (is_active = 0). Analyst or Sysadmin only."""
  username, role = _current_user()
  err = _require_analyst_or_sysadmin(role)
  if err:
    return err

  engine = None
  try:
    engine = _get_engine()
    with engine.connect() as conn:
      conn.execute(
        text("UPDATE dashboards SET is_active = 0 WHERE id = :id"),
        {"id": dash_id},
      )
      conn.commit()
    return jsonify({"ok": True}), 200
  except Exception as e:
    if engine is not None:
      engine.dispose()
    return jsonify({"error": str(e)}), 500

