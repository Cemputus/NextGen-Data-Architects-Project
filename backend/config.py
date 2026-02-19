import os
from pathlib import Path

BASE_DIR = Path(__file__).parent

# MySQL Configuration
MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
MYSQL_PORT = os.environ.get('MYSQL_PORT', '3306')
MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', 'root')
MYSQL_CHARSET = os.environ.get('MYSQL_CHARSET', 'utf8mb4')

# Database names
DB1_NAME = 'UCU_SourceDB1'
DB2_NAME = 'UCU_SourceDB2'
DATA_WAREHOUSE_NAME = 'UCU_DataWarehouse'

# SQLAlchemy connection strings (URL encode password)
from urllib.parse import quote_plus

def get_sqlalchemy_conn_string(database_name):
    """Generate SQLAlchemy connection string for MySQL"""
    password_encoded = quote_plus(MYSQL_PASSWORD) if MYSQL_PASSWORD else ''
    if password_encoded:
        return f"mysql+pymysql://{MYSQL_USER}:{password_encoded}@{MYSQL_HOST}:{MYSQL_PORT}/{database_name}?charset={MYSQL_CHARSET}"
    else:
        return f"mysql+pymysql://{MYSQL_USER}@{MYSQL_HOST}:{MYSQL_PORT}/{database_name}?charset={MYSQL_CHARSET}"

DB1_CONN_STRING = get_sqlalchemy_conn_string(DB1_NAME)
DB2_CONN_STRING = get_sqlalchemy_conn_string(DB2_NAME)
DATA_WAREHOUSE_CONN_STRING = get_sqlalchemy_conn_string(DATA_WAREHOUSE_NAME)

# PyMySQL connection parameters (for direct connections)
def get_pymysql_params(database_name):
    """Generate PyMySQL connection parameters"""
    return {
        'host': MYSQL_HOST,
        'port': int(MYSQL_PORT),
        'user': MYSQL_USER,
        'password': MYSQL_PASSWORD,
        'database': database_name,
        'charset': MYSQL_CHARSET,
        'autocommit': False
    }

# CSV paths (UCU tailored data)
CSV1_PATH = BASE_DIR / "data" / "source_data1.csv"
CSV2_PATH = BASE_DIR / "data" / "source_data2.csv"

# Medallion architecture paths
BRONZE_PATH = BASE_DIR / "data" / "bronze"
SILVER_PATH = BASE_DIR / "data" / "silver"
GOLD_PATH = BASE_DIR / "data" / "gold"

# Create directories
for path in [BRONZE_PATH, SILVER_PATH, GOLD_PATH]:
    path.mkdir(parents=True, exist_ok=True)

# Flask configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')

