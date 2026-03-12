from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING
import os

engine = create_engine(DATA_WAREHOUSE_CONN_STRING)

# Read the sql script
with open(os.path.join(os.path.dirname(__file__), 'sql', 'create_analytical_views.sql'), 'r') as f:
    sql = f.read()

# Execute each statement
# PostgreSQL requires splitting on ; or executing one big string if nothing fails
# In Python, we can just execute the whole block if using raw driver, but SQLAlchemy likes valid text statements. Let's just split by ;
statements = [s.strip() for s in sql.split(';') if s.strip()]

with engine.connect() as conn:
    for stmt in statements:
        conn.execute(text(stmt))
    conn.commit()
print("Successfully created analytical views.")
