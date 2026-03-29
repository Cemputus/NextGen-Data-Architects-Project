#!/usr/bin/env python3
"""Load seed_tuition_trends_demo.sql into the data warehouse (PostgreSQL)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg2

from config.connection import DATA_WAREHOUSE_NAME, get_pg_params


def main():
    sql_path = Path(__file__).resolve().parents[1] / 'sql' / 'seed_tuition_trends_demo.sql'
    if not sql_path.is_file():
        print(f'Missing {sql_path}', file=sys.stderr)
        sys.exit(1)
    sql = sql_path.read_text(encoding='utf-8')
    params = get_pg_params(DATA_WAREHOUSE_NAME)
    print(f'Connecting to database {DATA_WAREHOUSE_NAME!r}...')
    conn = psycopg2.connect(**params)
    try:
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
    finally:
        conn.close()
    print('Done. Tuition demo seed applied (idempotent).')


if __name__ == '__main__':
    main()
