-- Runs only on first PostgreSQL volume initialization (docker-entrypoint-initdb.d).
-- Airflow metadata DB; must exist before `airflow db migrate`.
CREATE DATABASE airflow_meta;
