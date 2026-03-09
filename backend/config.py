import os
from pathlib import Path

BASE_DIR = Path(__file__).parent

# PostgreSQL Configuration
PG_HOST = os.environ.get('PG_HOST', 'localhost')
PG_PORT = os.environ.get('PG_PORT', '5432')
PG_USER = os.environ.get('PG_USER', 'postgres')
PG_PASSWORD = os.environ.get('PG_PASSWORD', 'postgres')

# Database names
DB1_NAME = 'ucu_sourcedb1'
DB2_NAME = 'ucu_sourcedb2'
DATA_WAREHOUSE_NAME = 'ucu_datawarehouse'

# SQLAlchemy connection strings
from urllib.parse import quote_plus

def get_sqlalchemy_conn_string(database_name):
    """Generate SQLAlchemy connection string for PostgreSQL"""
    password_encoded = quote_plus(PG_PASSWORD) if PG_PASSWORD else ''
    if password_encoded:
        return f"postgresql+psycopg2://{PG_USER}:{password_encoded}@{PG_HOST}:{PG_PORT}/{database_name}"
    else:
        return f"postgresql+psycopg2://{PG_USER}@{PG_HOST}:{PG_PORT}/{database_name}"

DB1_CONN_STRING = get_sqlalchemy_conn_string(DB1_NAME)
DB2_CONN_STRING = get_sqlalchemy_conn_string(DB2_NAME)
DATA_WAREHOUSE_CONN_STRING = get_sqlalchemy_conn_string(DATA_WAREHOUSE_NAME)

# psycopg2 connection parameters (for direct connections)
def get_pg_params(database_name):
    """Generate psycopg2 connection parameters"""
    return {
        'host': PG_HOST,
        'port': int(PG_PORT),
        'user': PG_USER,
        'password': PG_PASSWORD,
        'dbname': database_name,
    }

# CSV paths (UCU tailored data)
CSV1_PATH = BASE_DIR / "data" / "source_data1.csv"
CSV2_PATH = BASE_DIR / "data" / "source_data2.csv"

# Medallion architecture paths
BRONZE_PATH = BASE_DIR / "data" / "bronze"
SILVER_PATH = BASE_DIR / "data" / "silver"
GOLD_PATH = BASE_DIR / "data" / "gold"

# Data source: synthetic is the primary source (backend/data/Synthetic_Data). ETL always uses it when the folder exists.
USE_SYNTHETIC_DATA = True
SYNTHETIC_DATA_DIR = BASE_DIR / "data" / "Synthetic_Data"

# Create directories
for path in [BRONZE_PATH, SILVER_PATH, GOLD_PATH]:
    path.mkdir(parents=True, exist_ok=True)

# Flask configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')

# ── Backward-compat aliases so any file that still imports the old names won't crash ──
MYSQL_HOST = PG_HOST
MYSQL_PORT = PG_PORT
MYSQL_USER = PG_USER
MYSQL_PASSWORD = PG_PASSWORD
MYSQL_CHARSET = 'utf8'          # unused with PG, but prevents ImportError at call sites
get_pymysql_params = get_pg_params   # alias
