"""
Generate project architecture & tech-stack PDF (ReportLab).
Run from backend: python scripts/generate_architecture_pdf.py
Output: docs/NextGen_System_Architecture_Report.pdf (repo root docs/)
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    Preformatted,
)

REPO_ROOT = backend_dir.parent
OUT_PATH = REPO_ROOT / "docs" / "NextGen_System_Architecture_Report.pdf"


def _safe_db_inventory():
    """
    Best-effort: query live Postgres for tables in each database.
    Returns list[dict] or None.
    """
    try:
        from sqlalchemy import create_engine, text
        from config import DB1_NAME, DB2_NAME, DATA_WAREHOUSE_NAME, get_sqlalchemy_conn_string

        dbs = [DB1_NAME, DB2_NAME, DATA_WAREHOUSE_NAME, "ucu_rbac", "airflow_meta"]
        out = []
        for db in dbs:
            try:
                eng = create_engine(get_sqlalchemy_conn_string(db), pool_pre_ping=True, future=True)
                with eng.connect() as conn:
                    rows = conn.execute(
                        text(
                            """
                            SELECT table_schema, table_name
                            FROM information_schema.tables
                            WHERE table_type='BASE TABLE'
                              AND table_schema NOT IN ('pg_catalog','information_schema')
                            ORDER BY table_schema, table_name
                            """
                        )
                    ).fetchall()
                tables = [{"schema": r[0], "table": r[1]} for r in rows]
                out.append({"database": db, "table_count": len(tables), "tables": tables})
                try:
                    eng.dispose()
                except Exception:
                    pass
            except Exception as e:
                out.append({"database": db, "error": str(e), "table_count": None, "tables": []})
        return out
    except Exception:
        return None


def _table_importance(db: str, schema: str, table: str) -> str:
    t = (table or "").lower()
    if db == "ucu_rbac":
        if t == "app_users":
            return "Application users + roles (login source of truth)."
        if t == "user_profiles":
            return "User profile metadata for UI."
        if t == "user_state":
            return "Persisted per-user UI/workspace state."
        if t == "audit_logs":
            return "Audit trail for admin/security actions."
        if t.startswith("dashboard") or t in ("dashboards", "role_current_dashboard", "page_config"):
            return "Dashboards + access control for roles/users."
        if "viz" in t or "query" in t:
            return "Analyst SQL workspace assets (visualizations/feedback)."
        return "RBAC/admin support table."
    if db == "ucu_datawarehouse":
        if t.startswith("dim_"):
            return "Dimension table used to slice facts (filters/labels)."
        if t.startswith("fact_"):
            return "Fact table powering KPIs, charts, and analytics."
        if schema in ("ucu_sourcedb1", "ucu_sourcedb2"):
            return "Source-mirror schema stored in warehouse DB (HR/admin operational tables)."
        return "Warehouse supporting table."
    if db in ("ucu_sourcedb1", "ucu_sourcedb2"):
        return "Operational/source table used as ETL input."
    if db == "airflow_meta":
        return "Airflow metadata table (runs/tasks/schedules)."
    return "Application table."


def _mono(text: str, size: int = 8) -> Preformatted:
    return Preformatted(
        text.rstrip() + "\n",
        ParagraphStyle(
            name="Mono",
            fontName="Courier",
            fontSize=size,
            leading=size + 1,
            leftIndent=0,
        ),
    )


def build_story():
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontSize=18,
        spaceAfter=12,
        textColor=colors.HexColor("#1a237e"),
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=14,
        spaceAfter=8,
        textColor=colors.HexColor("#283593"),
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        alignment=TA_JUSTIFY,
    )
    small = ParagraphStyle(
        "Small",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#424242"),
    )
    title = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontSize=22,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#1a237e"),
        spaceAfter=6,
    )
    subtitle = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        fontSize=11,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#5c6bc0"),
    )

    story = []

    story.append(Paragraph("NextGen Data Architects — UCU Analytics Platform", title))
    story.append(
        Paragraph(
            "Technical overview: databases, data warehouse, tech stack, and architecture",
            subtitle,
        )
    )
    story.append(Spacer(1, 0.4 * cm))
    story.append(
        Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')} — Source: repository scan (config, ETL, docker-compose, APIs).",
            small,
        )
    )
    story.append(Spacer(1, 0.6 * cm))

    story.append(Paragraph("1. PostgreSQL databases in the system", h2))
    story.append(
        Paragraph(
            "The application uses <b>one PostgreSQL server</b> hosting multiple logical databases. "
            "In a full local/docker deployment there are <b>five</b> named databases:",
            body,
        )
    )
    story.append(Spacer(1, 0.2 * cm))

    db_rows = [
        ["#", "Database name", "Role"],
        [
            "1",
            "<b>ucu_sourcedb1</b>",
            "Operational / academic-style source (students, courses, grades, enrollments, etc.). "
            "Simulates a student information system slice used as ETL input.",
        ],
        [
            "2",
            "<b>ucu_sourcedb2</b>",
            "Second source (e.g. HR: employees, positions, attendance). "
            "Separates administrative data from core academic data.",
        ],
        [
            "3",
            "<b>ucu_datawarehouse</b>",
            "<b>Gold</b> analytical store: star schema (dimensions + facts), primary target for dashboards and APIs.",
        ],
        [
            "4",
            "<b>ucu_rbac</b>",
            "Security and application state: app users, profiles, workspace state, audit logs. "
            "Keeps auth data out of the warehouse facts.",
        ],
        [
            "5",
            "<b>airflow_meta</b>",
            "Apache Airflow metadata (DAG runs, connections). Created by <i>postgres-init</i> for orchestration.",
        ],
    ]
    t = Table(db_rows, colWidths=[1.2 * cm, 4.2 * cm, 11.5 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a237e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey]),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            "<b>Note:</b> Docker init may also create schemas named like the source DBs inside a single database "
            "for HR tables; the Python app is configured for separate database names "
            "(see <i>backend/config.py</i> / <i>backend/config/connection.py</i>). "
            "Align deployment scripts with how you create databases.",
            small,
        )
    )

    story.append(Paragraph("2. Total number of data records", h2))
    story.append(
        Paragraph(
            "There is <b>no single static row count</b> checked into the repo: volumes depend on "
            "<i>setup_databases.py</i> runs (randomized ranges), synthetic CSV/XLSX packages, and ETL executions. "
            "Rough design targets include <b>1000+ rows per major source table</b> in generated setups, with facts in the "
            "warehouse matching ETL loads.",
            body,
        )
    )
    story.append(
        Paragraph(
            "<b>How to obtain exact totals in your environment:</b><br/>"
            "• Warehouse facts: run <i>backend/scripts/print_fact_counts.py</i> (fact tables).<br/>"
            "• Any table: <tt>SELECT COUNT(*) FROM &lt;table&gt;;</tt> in each database.<br/>"
            "• Medallion files: sum row counts of the <b>latest</b> bronze/silver Parquet snapshot only "
            "(multiple timestamps exist; do not sum all files or you double-count).",
            body,
        )
    )

    story.append(Paragraph("3. Nature of the data warehouse and rationale", h2))
    story.append(
        Paragraph(
            "<b>Medallion architecture (Bronze → Silver → Gold)</b><br/>"
            "• <b>Bronze</b>: raw or lightly typed extracts (Parquet under <tt>backend/data/bronze</tt>).<br/>"
            "• <b>Silver</b>: cleansed, conformed datasets (Parquet under <tt>backend/data/silver</tt>).<br/>"
            "• <b>Gold</b>: <b>PostgreSQL</b> in <tt>ucu_datawarehouse</tt> — star schema (dimensions + fact tables) for "
            "reporting, KPIs, and ML features.",
            body,
        )
    )
    story.append(
        Paragraph(
            "<b>Why these databases?</b><br/>"
            "• <b>Two sources (DB1 + DB2)</b>: models real separation between academic and HR/admin systems without "
            "merging operational concerns prematurely.<br/>"
            "• <b>Warehouse (PostgreSQL)</b>: strong SQL, constraints, and tooling for star schemas; single place for "
            "analytics and role-scoped APIs.<br/>"
            "• <b>RBAC database</b>: isolates credentials, profiles, and audit trails from analytical facts.<br/>"
            "• <b>Airflow DB</b>: standard pattern for workflow metadata.",
            body,
        )
    )

    story.append(Paragraph("4. Tech stack", h2))
    tech_rows = [
        ["Layer", "Technologies"],
        [
            "Frontend",
            "React 18, React Router, Chakra UI, Tailwind-related utilities, Axios, ECharts, Recharts, Plotly, "
            "Monaco Editor, jsPDF / ExcelJS / xlsx for exports",
        ],
        [
            "Backend API",
            "Flask 3, Flask-JWT-Extended, Flask-CORS, Gunicorn, Werkzeug, SQLAlchemy, psycopg2",
        ],
        ["Data & ML", "pandas, NumPy, scikit-learn, pyarrow (ETL Parquet)"],
        ["Reports", "ReportLab, openpyxl"],
        ["Orchestration", "Apache Airflow (DAGs under <tt>airflow/dags</tt>)"],
        ["Data stores", "PostgreSQL 16 (Docker image in compose)"],
        ["DevOps", "Docker Compose, Render blueprint (<tt>render.yaml</tt>)"],
    ]
    tt = Table(tech_rows, colWidths=[3.2 * cm, 13.7 * cm])
    tt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3949ab")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey]),
            ]
        )
    )
    story.append(tt)
    story.append(PageBreak())

    # --- Database tables inventory (live) ---
    story.append(Paragraph("5. Database tables (inventory)", h1))
    inv = _safe_db_inventory()
    if not inv:
        story.append(
            Paragraph(
                "Could not query the live databases for a table inventory. "
                "Start PostgreSQL (and run ETL/setup), then regenerate this PDF.",
                body,
            )
        )
    else:
        story.append(
            Paragraph(
                "Counts and table lists below are pulled from the running PostgreSQL instance "
                "(non-system schemas only).",
                body,
            )
        )
        story.append(Spacer(1, 0.2 * cm))

        for db in inv:
            dbname = db.get("database")
            err = db.get("error")
            if err:
                story.append(Paragraph(f"<b>{dbname}</b> — inventory failed: {err}", small))
                story.append(Spacer(1, 0.2 * cm))
                continue
            count = db.get("table_count") or 0
            story.append(Paragraph(f"<b>{dbname}</b> — {count} tables", h2))

            tables = db.get("tables") or []
            # Render as a compact table (schema.table + importance).
            rows = [["Schema.Table", "Importance"]]
            for t in tables:
                schema = t.get("schema") or "public"
                name = t.get("table") or ""
                imp = _table_importance(dbname, schema, name)
                rows.append([f"{schema}.{name}", imp])

            tbl = Table(rows, colWidths=[5.2 * cm, 11.7 * cm])
            tbl.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#263238")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey]),
                    ]
                )
            )
            story.append(tbl)
            story.append(Spacer(1, 0.3 * cm))

    story.append(PageBreak())

    story.append(Paragraph("6. Database architecture (logical)", h1))
    story.append(
        Paragraph(
            "High-level data flow from sources through medallion layers to consumption.",
            body,
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        _mono(
            """
+------------------+     +------------------+     +---------------------------+
|  ucu_sourcedb1   |     |  ucu_sourcedb2   |     |  Files (CSV/XLSX/         |
|  (academic       |     |  (HR / admin)    |     |   Synthetic_Data)        |
|   operational)   |     |                  |     |                           |
+--------+---------+     +--------+---------+     +-------------+-------------+
         |                          |                            |
         |         ETL Pipeline (extract / transform / load)     |
         |                          |                            |
         v                          v                            v
+---------------------------------------------------------------------+
|  BRONZE (Parquet)  ----->  SILVER (Parquet)  ----->  GOLD          |
|  raw landing              cleansed / conformed       PostgreSQL:     |
|                                                      ucu_datawarehouse
|                                                      star schema    |
+---------------------------------------------------------------------+
         |                                            |
         |                                            v
+--------+---------+                       +---------+----------+
|  ucu_rbac        |                       |  Dashboards & APIs   |
|  users, audit,   |<---- JWT / app ----->|  Flask + ML models |
|  workspace state |                       |  React SPA         |
+------------------+                       +--------------------+

Orchestration: Apache Airflow  -->  metadata DB:  airflow_meta
""",
            size=7,
        )
    )

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("7. System architecture (application)", h1))
    story.append(
        Paragraph(
            "End-to-end view of clients, API, and services.",
            body,
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        _mono(
            """
                         +-------------------+
                         |   Web browser     |
                         |   React SPA       |
                         +---------+---------+
                                   |  HTTPS / REST
                                   v
                         +---------+---------+
                         |   Flask API       |
                         |   JWT + RBAC      |
                         +----+--------+-----+
                              |        |
              +---------------+        +---------------+
              v                                v
    +------------------+              +------------------+
    | PostgreSQL       |              | Optional: ML     |
    | warehouse + RBAC |              | (scikit-learn)   |
    | + source DBs     |              +------------------+
    +------------------+

    +------------------+        +------------------+
    | Airflow web/     |        | ETL jobs         |
    | scheduler        | -----> | (bronze/silver/  |
    | (airflow_meta)   |        |  gold phases)    |
    +------------------+        +------------------+
""",
            size=7,
        )
    )

    story.append(Spacer(1, 0.5 * cm))
    story.append(
        Paragraph(
            "<i>This document was generated automatically. Tune database creation and record counts to match your deployment.</i>",
            small,
        )
    )

    return story


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT_PATH),
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )
    doc.build(build_story())
    print(f"Wrote: {OUT_PATH}")


if __name__ == "__main__":
    main()
