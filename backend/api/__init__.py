"""
API Blueprints Package
"""
from .auth import auth_bp
from .analytics import analytics_bp

try:
    from .predictions import predictions_bp
    __all__ = ['auth_bp', 'analytics_bp', 'predictions_bp']
except ImportError:
    __all__ = ['auth_bp', 'analytics_bp']
