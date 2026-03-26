"""
API Blueprints Package
"""
from .auth import auth_bp

# Analytics blueprint may fail to import if the module has syntax/indentation issues.
# Guard import so the rest of the service can still boot.
try:
    from .analytics import analytics_bp
except Exception:
    analytics_bp = None

try:
    from .predictions import predictions_bp
    __all__ = ['auth_bp', 'predictions_bp'] + (['analytics_bp'] if analytics_bp else [])
except ImportError:
    __all__ = ['auth_bp'] + (['analytics_bp'] if analytics_bp else [])
