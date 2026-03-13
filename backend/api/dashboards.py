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

from config import DATA_WAREHOUSE_CONN_STRING, DATA_WAREHOUSE_NAME
from api.auth import _ensure_ucu_rbac_database, RBAC_DB_NAME


dashboards_bp = Blueprint("dashboards", __name__, url_prefix="/api/dashboards")


def _get_rbac_conn_string() -> str:
  return DATA_WAREHOUSE_CONN_STRING.replace(DATA_WAREHOUSE_NAME, RBAC_DB_NAME)


def _ensure_default_role_dashboards(conn, all_roles, updated_by_username: str):
  """
  Ensure that each role in all_roles has a current dashboard assigned.
  If no dashboards exist at all, create a single default analytics dashboard
  and assign it to all roles as their current dashboard.
  """
  total_dashboards = conn.execute(
    text("SELECT COUNT(*) AS c FROM dashboards")
  ).scalar() or 0

  default_dashboard_id = None

  if total_dashboards == 0:
    default_dashboard_id = uuid.uuid4().hex
    conn.execute(
      text(
        """
        INSERT INTO dashboards (
          id, name, description, created_by_username, created_by_role, definition, is_active
        ) VALUES (
          :id, :name, :description, :created_by_username, :created_by_role, :definition, TRUE
        )
        """
      ),
      {
        "id": default_dashboard_id,
        "name": "Default Analytics Dashboard",
        "description": "Auto-created default dashboard showing core analytics for all roles.",
        "created_by_username": updated_by_username or "system",
        "created_by_role": "sysadmin",
        "definition": json.dumps(
          {
            "template": "analytics_dashboard",
            "source": "analyst_dashboard",
            "kpis": [
              "total_students",
              "avg_grade",
              "failed_exams",
              "missed_exams",
              "avg_attendance",
            ],
            "charts": [
              "student_distribution",
              "grades_over_time",
              "grade_distribution",
            ],
          }
        ),
      },
    )
    for rname in all_roles:
      conn.execute(
        text(
          """
          INSERT INTO dashboard_role_access (dashboard_id, role_name)
          VALUES (:dashboard_id, :role_name)
          ON CONFLICT (dashboard_id, role_name) DO NOTHING
          """
        ),
        {"dashboard_id": default_dashboard_id, "role_name": rname},
      )

  if default_dashboard_id is not None:
    for rname in all_roles:
      exists = conn.execute(
        text(
          """
          SELECT 1 FROM role_current_dashboard
          WHERE role_name = :role_name
          """
        ),
        {"role_name": rname},
      ).scalar()
      if not exists:
        conn.execute(
          text(
            """
            INSERT INTO role_current_dashboard (role_name, dashboard_id, updated_by_username)
            VALUES (:role_name, :dashboard_id, :updated_by_username)
            ON CONFLICT (role_name) DO NOTHING
            """
          ),
          {
            "role_name": rname,
            "dashboard_id": default_dashboard_id,
            "updated_by_username": updated_by_username or "system",
          },
        )


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
            definition TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
          """
        )
      )
      conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dash_created_by ON dashboards(created_by_username)"))
      conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dash_active ON dashboards(is_active)"))
      conn.execute(
        text(
          """
          CREATE TABLE IF NOT EXISTS dashboard_role_access (
            id SERIAL PRIMARY KEY,
            dashboard_id VARCHAR(64) NOT NULL,
            role_name VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (dashboard_id, role_name),
            FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
          )
          """
        )
      )
      conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dra_role ON dashboard_role_access(role_name)"))
      conn.execute(
        text(
          """
          CREATE TABLE IF NOT EXISTS dashboard_user_access (
            id SERIAL PRIMARY KEY,
            dashboard_id VARCHAR(64) NOT NULL,
            username VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (dashboard_id, username),
            FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
          )
          """
        )
      )
      conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dua_username ON dashboard_user_access(username)"))
      conn.execute(
        text(
          """
          CREATE TABLE IF NOT EXISTS role_current_dashboard (
            id SERIAL PRIMARY KEY,
            role_name VARCHAR(50) NOT NULL UNIQUE,
            dashboard_id VARCHAR(64) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by_username VARCHAR(100),
            FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
          )
          """
        )
      )
      conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rcd_role_name ON role_current_dashboard(role_name)"))
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
        WHERE d.is_active = TRUE
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
            WHERE d.is_active = TRUE
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


# --- Dashboard Manager (current vs custom, swap) ---
dashboard_manager_bp = Blueprint("dashboard_manager", __name__, url_prefix="/api/dashboard-manager")


@dashboard_manager_bp.route("/current", methods=["GET"])
@jwt_required()
def get_current_dashboards():
  """
  Return the current dashboard per role (pointer in role_current_dashboard).

  Roles covered: student, staff, hod, dean, senate, finance, hr, analyst, sysadmin.
  Only analyst/sysadmin can read this view.
  """
  username, role = _current_user()
  if role not in ("analyst", "sysadmin"):
    return jsonify({"error": "Permission denied. Only Analyst or Sysadmin can view dashboard manager."}), 403

  all_roles = ["student", "staff", "hod", "dean", "senate", "finance", "hr", "analyst", "sysadmin"]
  engine = None
  try:
    engine = _get_engine()
    result_payload = []
    with engine.connect() as conn:
      # Ensure there is at least one default dashboard assigned for all roles
      _ensure_default_role_dashboards(conn, all_roles, username)

      # Fetch role->dashboard mapping
      rows = conn.execute(
        text(
          """
          SELECT r.role_name, r.dashboard_id, r.updated_at, r.updated_by_username,
                 d.id AS d_id, d.name, d.description, d.created_by_username, d.created_by_role, d.definition, d.updated_at AS d_updated_at
          FROM role_current_dashboard r
          LEFT JOIN dashboards d ON d.id = r.dashboard_id
          WHERE d.is_active = 1 OR d.id IS NULL
          """
        )
      ).mappings()
      by_role = {row["role_name"].strip().lower(): row for row in rows}

      for rname in all_roles:
        row = by_role.get(rname)
        if row and row["d_id"]:
          dash_id = row["d_id"]
          # Attach roles/users for card metadata
          role_rows = conn.execute(
            text("SELECT role_name FROM dashboard_role_access WHERE dashboard_id = :id"),
            {"id": dash_id},
          ).scalars()
          user_rows = conn.execute(
            text("SELECT username FROM dashboard_user_access WHERE dashboard_id = :id"),
            {"id": dash_id},
          ).scalars()
          result_payload.append(
            {
              "role": rname,
              "dashboard": {
                "id": dash_id,
                "name": row["name"],
                "description": row["description"],
                "created_by_username": row["created_by_username"],
                "created_by_role": row["created_by_role"],
                "definition": row["definition"],
                "updated_at": row["d_updated_at"],
                "roles": [rr for rr in role_rows],
                "users": [uu for uu in user_rows],
              },
              "pointer_updated_at": row["updated_at"],
              "pointer_updated_by_username": row["updated_by_username"],
            }
          )
        else:
          result_payload.append(
            {
              "role": rname,
              "dashboard": None,
              "pointer_updated_at": None,
              "pointer_updated_by_username": None,
            }
          )

    # Analysts cannot assign dashboards to admin: exclude sysadmin from the list they see
    if role == "analyst":
      result_payload = [x for x in result_payload if x.get("role") != "sysadmin"]

    return jsonify({"roles": result_payload}), 200
  except Exception as e:
    if engine is not None:
      engine.dispose()
    return jsonify({"error": str(e)}), 500


@dashboard_manager_bp.route("/custom", methods=["GET"])
@jwt_required()
def get_custom_dashboards():
  """
  Return dashboards available for assignment ("custom").
  Includes all active dashboards; frontend can visually distinguish which ones
  are already current for a role if needed.

  Query params:
  - role: optional role_name to bias/limit results by assigned role access
  - created_by: 'me' to limit to dashboards created by current analyst
  """
  username, role = _current_user()
  if role not in ("analyst", "sysadmin"):
    return jsonify({"error": "Permission denied. Only Analyst or Sysadmin can view dashboard manager."}), 403

  filter_role = (request.args.get("role") or "").strip().lower()
  created_by = (request.args.get("created_by") or "").strip().lower()

  engine = None
  try:
    engine = _get_engine()
    with engine.connect() as conn:
      base_sql = """
        SELECT d.*
        FROM dashboards d
        WHERE d.is_active = 1
      """
      params: Dict[str, Any] = {}

      if created_by == "me":
        base_sql += " AND LOWER(d.created_by_username) = :created_by"
        params["created_by"] = username.lower()

      if filter_role:
        # Only dashboards that have this role in dashboard_role_access
        base_sql += """
          AND EXISTS (
            SELECT 1 FROM dashboard_role_access dra
            WHERE dra.dashboard_id = d.id AND LOWER(dra.role_name) = :f_role
          )
        """
        params["f_role"] = filter_role

      base_sql += " ORDER BY d.updated_at DESC"

      result = conn.execute(text(base_sql), params).mappings()
      dashboards: List[Dict[str, Any]] = []
      for row in result:
        did = row["id"]
        dash = dict(row)
        # Attach roles/users
        role_rows = conn.execute(
          text("SELECT role_name FROM dashboard_role_access WHERE dashboard_id = :id"),
          {"id": did},
        ).scalars()
        user_rows = conn.execute(
          text("SELECT username FROM dashboard_user_access WHERE dashboard_id = :id"),
          {"id": did},
        ).scalars()
        dash["roles"] = [rr for rr in role_rows]
        dash["users"] = [uu for uu in user_rows]
        dashboards.append(dash)

    return jsonify({"dashboards": dashboards}), 200
  except Exception as e:
    if engine is not None:
      engine.dispose()
    return jsonify({"error": str(e)}), 500


@dashboard_manager_bp.route("/swap", methods=["POST"])
@jwt_required()
def swap_dashboard():
  """
  Swap the current dashboard for a role with a selected custom dashboard.

  Body: { "role": "<role_name>", "dashboard_id": "<uuid>" }
  - Only analyst/sysadmin allowed.
  - Operation is atomic: updates role_current_dashboard.
  """
  username, role = _current_user()
  if role not in ("analyst", "sysadmin"):
    return jsonify({"error": "Permission denied. Only Analyst or Sysadmin can swap dashboards."}), 403

  data = request.get_json(silent=True) or {}
  target_role = (data.get("role") or "").strip().lower()
  dashboard_id = (data.get("dashboard_id") or "").strip()

  if not target_role or not dashboard_id:
    return jsonify({"error": "Both role and dashboard_id are required."}), 400

  # Analysts cannot assign or swap dashboards for the admin (sysadmin) role
  if role == "analyst" and target_role == "sysadmin":
    return jsonify({"error": "Analysts cannot assign dashboards to the Admin role. Admin dashboard is managed separately."}), 403

  engine = None
  try:
    engine = _get_engine()
    with engine.connect() as conn:
      conn = conn.execution_options(autocommit=False)

      # Ensure dashboard exists and is active
      row = conn.execute(
        text("SELECT id FROM dashboards WHERE id = :id AND is_active = TRUE"),
        {"id": dashboard_id},
      ).scalar()
      if not row:
        return jsonify({"error": "Dashboard not found or inactive."}), 404

      # Upsert role_current_dashboard pointer
      conn.execute(
        text(
          """
          INSERT INTO role_current_dashboard (role_name, dashboard_id, updated_by_username)
          VALUES (:role_name, :dashboard_id, :updated_by)
          ON CONFLICT (role_name) DO UPDATE SET
            dashboard_id = EXCLUDED.dashboard_id,
            updated_by_username = EXCLUDED.updated_by_username
          """
        ),
        {
          "role_name": target_role,
          "dashboard_id": dashboard_id,
          "updated_by": username,
        },
      )
      conn.commit()

    return jsonify({"ok": True}), 200
  except Exception as e:
    if engine is not None:
      engine.dispose()
    return jsonify({"error": str(e)}), 500


@dashboard_manager_bp.route("/remove-current", methods=["POST"])
@jwt_required()
def remove_current_dashboard():
  """
  Remove the current dashboard for a role (no dashboard assigned).
  Body: { "role": "<role_name>" }. Only analyst/sysadmin.
  """
  username, role = _current_user()
  if role not in ("analyst", "sysadmin"):
    return jsonify({"error": "Permission denied. Only Analyst or Sysadmin can remove current dashboard."}), 403

  data = request.get_json(silent=True) or {}
  target_role = (data.get("role") or "").strip().lower()
  if not target_role:
    return jsonify({"error": "role is required."}), 400

  # Analysts cannot remove current dashboard for the admin (sysadmin) role
  if role == "analyst" and target_role == "sysadmin":
    return jsonify({"error": "Analysts cannot change the Admin role's dashboard. Admin dashboard is managed separately."}), 403

  engine = None
  try:
    engine = _get_engine()
    with engine.connect() as conn:
      conn.execute(
        text("DELETE FROM role_current_dashboard WHERE role_name = :role_name"),
        {"role_name": target_role},
      )
      conn.commit()
    return jsonify({"ok": True}), 200
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

  # Analysts cannot assign dashboards to the admin (sysadmin) role
  if role == "analyst":
    roles = [r for r in roles if r != "sysadmin"]

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
          VALUES (:id, :name, :description, :created_by, :created_role, :definition, TRUE)
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
            ON CONFLICT (dashboard_id, role_name) DO NOTHING
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
            ON CONFLICT (dashboard_id, username) DO NOTHING
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
        text("SELECT id, created_by_username FROM dashboards WHERE id = :id AND is_active = TRUE"),
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
        # Analysts cannot assign dashboards to the admin (sysadmin) role
        if role == "analyst":
          roles_norm = [r for r in roles_norm if r != "sysadmin"]
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


@dashboards_bp.route("/current", methods=["GET"])
@jwt_required()
def get_current_dashboard_for_role():
  """
  Return the current dashboard for the authenticated user's primary role, if any.

  This is used by role-specific dashboards (student, staff, dean, etc.) to know
  which dashboard layout/definition to render as their 'live' dashboard.
  """
  username, role = _current_user()
  engine = None
  try:
    engine = _get_engine()
    with engine.connect() as conn:
      row = conn.execute(
        text(
          """
          SELECT r.role_name, r.dashboard_id, r.updated_at, r.updated_by_username,
                 d.*
          FROM role_current_dashboard r
          LEFT JOIN dashboards d ON d.id = r.dashboard_id
          WHERE LOWER(r.role_name) = :rname AND d.is_active = TRUE
          """
        ),
        {"rname": role},
      ).mappings().first()
      if not row or not row["id"]:
        return jsonify({"dashboard": None}), 200

      dash_id = row["id"]
      # Attach roles/users
      role_rows = conn.execute(
        text("SELECT role_name FROM dashboard_role_access WHERE dashboard_id = :id"),
        {"id": dash_id},
      ).scalars()
      user_rows = conn.execute(
        text("SELECT username FROM dashboard_user_access WHERE dashboard_id = :id"),
        {"id": dash_id},
      ).scalars()

      dash = {
        "id": dash_id,
        "name": row["name"],
        "description": row["description"],
        "created_by_username": row["created_by_username"],
        "created_by_role": row["created_by_role"],
        "definition": row["definition"],
        "updated_at": row["updated_at"],
        "roles": [rr for rr in role_rows],
        "users": [uu for uu in user_rows],
      }
    return jsonify({"dashboard": dash}), 200
  except Exception as e:
    if engine is not None:
      engine.dispose()
    return jsonify({"error": str(e)}), 500


@dashboards_bp.route("/<dash_id>", methods=["DELETE"])
@jwt_required()
def delete_dashboard(dash_id):
  """Soft delete a dashboard (is_active = 0). Analyst or Sysadmin only. Cannot delete if current for any role."""
  username, role = _current_user()
  err = _require_analyst_or_sysadmin(role)
  if err:
    return err

  engine = None
  try:
    engine = _get_engine()
    with engine.connect() as conn:
      rows = conn.execute(
        text("SELECT role_name FROM role_current_dashboard WHERE dashboard_id = :id"),
        {"id": dash_id},
      ).mappings()
      roles_using = [r["role_name"] for r in rows]
      if roles_using:
        return (
          jsonify({
            "error": "Cannot delete: this dashboard is the current dashboard for role(s): "
            + ", ".join(roles_using)
            + ". Remove it from current dashboard for those roles first.",
          }),
          400,
        )
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

