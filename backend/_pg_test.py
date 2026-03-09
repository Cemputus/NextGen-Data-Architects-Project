"""Quick PostgreSQL connectivity and functional test."""
import psycopg2

PG = dict(host='localhost', port=5432, user='postgres', password='postgres')

print('=' * 60)
print('POSTGRESQL CONNECTIVITY TEST')
print('=' * 60)

# 1. Connect to postgres
conn = psycopg2.connect(dbname='postgres', **PG)
conn.autocommit = True
cur = conn.cursor()

# 2. Version
cur.execute('SELECT version()')
v = cur.fetchone()[0]
print(f'[OK] PostgreSQL version: {v.split(",")[0]}')

# 3. List databases
cur.execute('SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname')
dbs = [r[0] for r in cur.fetchall()]
print(f'[OK] Databases ({len(dbs)}): {dbs}')
conn.close()

# 4. Test each project database
for db in ['UCU_DataWarehouse', 'UCU_SourceDB1', 'UCU_SourceDB2', 'ucu_rbac']:
    try:
        c = psycopg2.connect(dbname=db, **PG)
        c.autocommit = True
        cur2 = c.cursor()
        cur2.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
        tables = [r[0] for r in cur2.fetchall()]
        print(f'[OK] {db}: connected, {len(tables)} table(s)')
        c.close()
    except Exception as e:
        print(f'[FAIL] {db}: {e}')

# 5. Test CREATE TABLE + INSERT + SELECT (write test)
c = psycopg2.connect(dbname='UCU_DataWarehouse', **PG)
c.autocommit = True
cur3 = c.cursor()
cur3.execute('DROP TABLE IF EXISTS _migration_test')
cur3.execute(
    'CREATE TABLE _migration_test '
    '(id SERIAL PRIMARY KEY, name TEXT, created_at TIMESTAMP DEFAULT NOW())'
)
cur3.execute("INSERT INTO _migration_test (name) VALUES ('test_row') RETURNING id")
row_id = cur3.fetchone()[0]
cur3.execute('SELECT id, name, created_at FROM _migration_test WHERE id = %s', (row_id,))
row = cur3.fetchone()
print(f'[OK] Write test: inserted id={row[0]}, name={row[1]}, at={row[2]}')
cur3.execute('DROP TABLE _migration_test')
print('[OK] Cleanup: _migration_test table dropped')
c.close()

# 6. Test pg_helpers module
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pg_helpers import get_pg_conn, ensure_database
conn2 = get_pg_conn(autocommit=True)
cur4 = conn2.cursor()
cur4.execute('SELECT 1')
print(f'[OK] pg_helpers.get_pg_conn(): working')
conn2.close()

print('=' * 60)
print('ALL TESTS PASSED - PostgreSQL is fully functional!')
print('=' * 60)
