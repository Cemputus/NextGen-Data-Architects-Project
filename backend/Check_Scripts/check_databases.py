"""
Script to check all databases, tables, and row counts — PostgreSQL version
"""
import psycopg2
from config import (
    PG_HOST, PG_PORT, PG_USER, PG_PASSWORD,
    DB1_NAME, DB2_NAME, DATA_WAREHOUSE_NAME
)

def get_database_info():
    """Get information about all databases, tables, and row counts"""
    try:
        conn = psycopg2.connect(
            host=PG_HOST,
            port=int(PG_PORT),
            user=PG_USER,
            password=PG_PASSWORD,
            dbname="postgres"
        )
        conn.autocommit = True
        cursor = conn.cursor()

        # Get all databases (excluding system databases)
        cursor.execute("""
            SELECT datname FROM pg_database
            WHERE datistemplate = false AND datname NOT IN ('postgres')
            ORDER BY datname
        """)
        all_dbs = [row[0] for row in cursor.fetchall()]
        conn.close()

        print("=" * 80)
        print(f"DATABASE INVENTORY - Total Databases: {len(all_dbs)}")
        print("=" * 80)

        total_tables = 0
        total_rows = 0

        for db_name in sorted(all_dbs):
            try:
                db_conn = psycopg2.connect(
                    host=PG_HOST,
                    port=int(PG_PORT),
                    user=PG_USER,
                    password=PG_PASSWORD,
                    dbname=db_name
                )
                db_conn.autocommit = True
                db_cursor = db_conn.cursor()

                # Get tables in the public schema
                db_cursor.execute("""
                    SELECT tablename FROM pg_tables
                    WHERE schemaname = 'public'
                    ORDER BY tablename
                """)
                tables = [row[0] for row in db_cursor.fetchall()]

                if not tables:
                    db_conn.close()
                    continue

                print(f"\n{'='*80}")
                print(f"DATABASE: {db_name}")
                print(f"{'='*80}")
                print(f"Tables: {len(tables)}")
                print("-" * 80)

                db_total_rows = 0

                for table in sorted(tables):
                    try:
                        db_cursor.execute(f'SELECT COUNT(*) FROM "{table}"')
                        row_count = db_cursor.fetchone()[0]
                        db_total_rows += row_count
                        total_rows += row_count

                        # Get column count
                        db_cursor.execute("""
                            SELECT COUNT(*) FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = %s
                        """, (table,))
                        num_columns = db_cursor.fetchone()[0]

                        print(f"  📊 {table:40s} | Rows: {row_count:>8,} | Columns: {num_columns:>3}")
                        total_tables += 1
                    except Exception as e:
                        print(f"  ❌ {table:40s} | Error: {str(e)}")

                print("-" * 80)
                print(f"  Total rows in {db_name}: {db_total_rows:,}")
                db_conn.close()

            except Exception as e:
                print(f"\n❌ Error accessing database '{db_name}': {str(e)}")

        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Total Databases: {len(all_dbs)}")
        print(f"Total Tables:    {total_tables}")
        print(f"Total Rows:      {total_rows:,}")
        print("=" * 80)

    except Exception as e:
        print(f"❌ Error connecting to PostgreSQL: {str(e)}")

if __name__ == "__main__":
    get_database_info()
