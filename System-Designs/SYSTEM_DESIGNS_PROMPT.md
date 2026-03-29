# Copy everything below the line into Cursor chat (Agent mode)

---

You are documenting **system design** for this repository: NextGen / UCU Data Engineering analytics platform (React frontend, FastAPI backend, PostgreSQL, ETL/ML as implemented here).

**Goal:** Create a set of **Markdown files** under the folder `System-Designs/` at the project root. Use **Mermaid** for diagrams (flowcharts, C4-style boxes, sequence, ER, DFD-style flows) so they render in GitHub and most Markdown viewers. Base all names, roles, and flows on **actual code and config** in this repo—read `README.md`, `backend/rbac.py`, `render.yaml`, API routes, and frontend routes—do not invent features that do not exist.

**Create these files (one topic per file, clear headings):**

1. **`01-system-context.md`** — Context diagram (Mermaid): system boundary, external actors (9 user types + any external systems), data at boundary level.

2. **`02-architecture.md`** — Logical architecture: layers (presentation, API, services, data), major components. Optional second diagram: **deployment** aligned with `render.yaml` / hosting.

3. **`03-user-journeys.md`** — How users navigate the app: one **combined** Mermaid flowchart or **swimlane** diagram covering all **nine roles** (student, staff, HOD, dean, senate, finance, HR, analyst, sysadmin). Show shared paths (e.g. login) then role branches. Add a short bullet list per role: primary screens/actions.

4. **`04-data-flow-diagrams.md`** — DFD-style description: **Level 0** (context), **Level 1** (main processes: auth, analytics, predictions, admin, ETL if applicable). Use Mermaid flowchart or similar—label stores and flows accurately.

5. **`05-data-model.md`** — **ER-style** diagram (Mermaid `erDiagram` or textual schema overview) for core persisted entities and relationships (users, roles, RBAC, key domain tables as in `backend/sql/`). Keep it readable; split into “core identity/RBAC” vs “domain” if needed.

6. **`06-rbac-security.md`** — RBAC matrix (table in Markdown): role × main resources/actions. Short notes on authentication (how login works in this app). Reference `backend/rbac.py` and frontend `config/roles.js`.

7. **`07-api-and-integrations.md`** — High-level API map: route groups, purpose, and main consumers. Optional: sequence diagram for **login** and **one** critical flow (e.g. prediction or analytics query).

8. **`08-operations-nfrs.md`** — Brief non-functional view: hosting, env vars at high level, backups/migrations if documented, scalability assumptions—only what the repo supports.

**Conventions:**
- Cross-link between files where helpful (`[text](./02-architecture.md)`).
- If something is unclear from the repo, state **assumption** in italics rather than guessing silently.
- Do **not** duplicate the entire README; these docs are **design views** (diagrams + concise explanation).

After writing, list created/updated files in your reply.

---
