# System Design Documentation

Professional design views for the **UCU NextGen Analytics & Prediction Platform** (final-year project). These documents complement the main [README](../README.md) with architecture, data, security, and operations perspectives.

| # | Document | Summary |
|---|----------|---------|
| 1 | [01-system-context](./01-system-context.md) | System boundary, actors, external systems |
| 2 | [02-architecture](./02-architecture.md) | Logical layers and deployment (Render / Vercel) |
| 3 | [03-user-journeys](./03-user-journeys.md) | Role-based navigation and primary actions |
| 4 | [04-data-flow-diagrams](./04-data-flow-diagrams.md) | DFD-style flows (Level 0 / Level 1) |
| 5 | [05-data-model](./05-data-model.md) | Warehouse star schema and RBAC stores |
| 6 | [06-rbac-security](./06-rbac-security.md) | Roles, resources, authentication |
| 7 | [07-api-and-integrations](./07-api-and-integrations.md) | API surface and key sequences |
| 8 | [08-operations-nfrs](./08-operations-nfrs.md) | Hosting, env vars, NFR assumptions |
| — | [09-etl-data-warehouse-erd](./09-etl-data-warehouse-erd.md) | Detailed ERD: warehouse star schema, views, HR mirror, `dim_app_user` |
| — | [10-users-and-employees-domain-erd](./10-users-and-employees-domain-erd.md) | Nine roles + employees: entities, org scope, cross-role relationships |

**Architecture figures (raster):** PNGs live in **[`../readme-images/`](../readme-images/)** (repo root) for reliable Markdown preview; see [`designs/README.md`](./designs/README.md).

| Document | Diagram asset |
|----------|----------------|
| [01-system-context](./01-system-context.md) | [System context PNG](../readme-images/01-system-context.png) |
| [02-architecture](./02-architecture.md) | [Logical architecture PNG](../readme-images/02-logical-architecture.png) |
| [04-data-flow-diagrams](./04-data-flow-diagrams.md) | [DFD Level 0 PNG](../readme-images/04-dfd-level-0.png), [DFD Level 1 PNG](../readme-images/04-dfd-level-1-main-processes.png) |

**Source of truth:** behaviour and names are derived from the codebase (`backend/`, `frontend/`, `render.yaml`, `backend/rbac.py`), not from this folder alone.
