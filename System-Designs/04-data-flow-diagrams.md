# 04 — Data Flow Diagrams (DFD-style)

## Level 0 — Context (process vs external stores)

```mermaid
flowchart LR
    U[Users] --> P[NextGen Platform\nFlask API + React]
    P --> DW[(Data warehouse)]
    P --> RB[(RBAC database)]
    P --> FS[Files / exports]
    ETL[ETL / Airflow / admin jobs] --> DW
    ETL --> FS
```

## Level 1 — Main processes

```mermaid
flowchart TB
    subgraph Sources["External / upstream"]
        FILES[CSV / XLSX synthetic data]
        ADMIN[Admin ETL triggers]
    end

    subgraph P1["P1 — Authentication"]
        A1[Validate credentials]
        A2[Issue JWT + refresh]
    end

    subgraph P2["P2 — Analytics & dashboards"]
        Q1[SQL / pandas queries]
        Q2[Scoped filters faculty/dept/student]
    end

    subgraph P3["P3 — Predictions"]
        M1[MultiModelPredictor]
        M2[Enhanced tuition–attendance model]
    end

    subgraph P4["P4 — Administration"]
        U1[User CRUD]
        E1[ETL job control]
        L1[Audit logs]
    end

    subgraph Stores["Data stores"]
        DW[(Warehouse dim_* fact_*)]
        RBDB[(ucu_rbac app_users audit)]
    end

    FILES --> ETL
    ADMIN --> ETL
    ETL --> DW

    U[User browser] --> A1
    A1 --> RBDB
    A1 --> A2

    U --> Q1
    Q1 --> DW
    Q2 --> DW

    U --> M1
    U --> M2
    M1 --> DW
    M2 --> DW

    U --> U1
    U1 --> RBDB
    U --> E1
    E1 --> DW
    U --> L1
    L1 --> RBDB
```

## Notation

- **Flows** are HTTPS JSON unless noted (exports may be files).
- **Scope** (own / class / department / faculty) is enforced in API handlers using JWT claims + query filters — see [`backend/rbac.py`](../backend/rbac.py).

## Related documents

- [Data model](./05-data-model.md)
- [API map](./07-api-and-integrations.md)
