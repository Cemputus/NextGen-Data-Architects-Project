import os
from pathlib import Path
from urllib.parse import urlparse, quote_plus

BASE_DIR = Path(__file__).resolve().parent.parent

# PostgreSQL Configuration
# When deploying (e.g. Render), DATABASE_URL can be set and overrides PG_* for the same host/user/password.
_db_url = os.environ.get('DATABASE_URL')
_db_name_override = None  # set when DATABASE_URL provides a specific db name (e.g. Render)
if _db_url:
    # Support postgres:// and postgresql://; ensure netloc is parsed (password may contain @)
    if _db_url.startswith('postgres://'):
        _db_url = 'postgresql://' + _db_url.split('://', 1)[1]
    _p = urlparse(_db_url)
    _host = _p.hostname or 'localhost'
    _port = _p.port or 5432
    _user = _p.username or 'postgres'
    _password = (_p.password or '') if _p.password is not None else ''
    # If DATABASE_URL points to a specific db (e.g. Render managed DB), use it for all connections
    _db_name_override = _p.path.lstrip('/') or None
    # Production-safe default: when DATABASE_URL is set, treat it as the source of truth.
    # This prevents accidental overrides like PG_HOST=postgres (docker-compose service name)
    # from breaking Render/managed Postgres deployments.
    #
    # If you truly need to override DATABASE_URL parts, set PG_ENV_OVERRIDE=1 explicitly.
    _allow_override = os.environ.get("PG_ENV_OVERRIDE", "").strip().lower() in ("1", "true", "yes", "on")
    PG_HOST = (os.environ.get('PG_HOST') if _allow_override else None) or _host
    PG_PORT = (os.environ.get('PG_PORT') if _allow_override else None) or str(_port)
    PG_USER = (os.environ.get('PG_USER') if _allow_override else None) or _user
    PG_PASSWORD = (os.environ.get('PG_PASSWORD') if _allow_override else None) or _password
else:
    PG_HOST = os.environ.get('PG_HOST', 'localhost')
    PG_PORT = os.environ.get('PG_PORT', '5432')
    PG_USER = os.environ.get('PG_USER', 'postgres')
    PG_PASSWORD = os.environ.get('PG_PASSWORD', 'postgres')

# Database names — on Render all schemas live in one database (_db_name_override)
DB1_NAME = _db_name_override or 'ucu_sourcedb1'
DB2_NAME = _db_name_override or 'ucu_sourcedb2'
DATA_WAREHOUSE_NAME = _db_name_override or 'ucu_datawarehouse'
RBAC_DB_NAME = _db_name_override or 'ucu_rbac'


def get_sqlalchemy_conn_string(database_name: str) -> str:
    """Generate SQLAlchemy connection string for PostgreSQL."""
    password_encoded = quote_plus(PG_PASSWORD) if PG_PASSWORD else ''
    if password_encoded:
        return f"postgresql+psycopg2://{PG_USER}:{password_encoded}@{PG_HOST}:{PG_PORT}/{database_name}"
    return f"postgresql+psycopg2://{PG_USER}@{PG_HOST}:{PG_PORT}/{database_name}"


DB1_CONN_STRING = get_sqlalchemy_conn_string(DB1_NAME)
DB2_CONN_STRING = get_sqlalchemy_conn_string(DB2_NAME)
DATA_WAREHOUSE_CONN_STRING = get_sqlalchemy_conn_string(DATA_WAREHOUSE_NAME)


def get_pg_params(database_name: str) -> dict:
    """Generate psycopg2 connection parameters."""
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

for path in [BRONZE_PATH, SILVER_PATH, GOLD_PATH]:
    path.mkdir(parents=True, exist_ok=True)

# Flask configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')

# Tuition payment trends: illustrative series when warehouse has no rows (see tuition_trends_synthetic.py).
TUITION_TRENDS_SYNTHETIC_FALLBACK = os.environ.get('TUITION_TRENDS_SYNTHETIC_FALLBACK', '1').lower() in (
    '1',
    'true',
    'yes',
)

