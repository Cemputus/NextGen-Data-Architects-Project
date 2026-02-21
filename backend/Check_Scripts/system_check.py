"""
System Health Check Script
Checks if all components are properly configured and can be imported
"""
import sys
from pathlib import Path

def check_imports():
    """Check if all required modules can be imported"""
    errors = []
    warnings = []
    
    print("=" * 60)
    print("SYSTEM HEALTH CHECK")
    print("=" * 60)
    
    # Check Python version
    print(f"\n✓ Python Version: {sys.version}")
    
    # Check backend directory structure
    backend_dir = Path(__file__).parent
    required_files = [
        'app.py',
        'etl_pipeline.py',
        'config.py',
        'rbac.py',
        'ml_models.py',
        'api/auth.py',
        'api/analytics.py',
        'utils/payment_deadlines.py'
    ]
    
    print("\n📁 Checking file structure...")
    for file_path in required_files:
        full_path = backend_dir / file_path
        if full_path.exists():
            print(f"  ✓ {file_path}")
        else:
            errors.append(f"Missing file: {file_path}")
            print(f"  ✗ {file_path} - MISSING")
    
    # Check frontend directory structure
    frontend_dir = backend_dir.parent / 'frontend'
    if frontend_dir.exists():
        frontend_files = [
            'src/components/RoleBasedCharts.jsx',
            'src/pages/StudentDashboard.js',
            'src/pages/FinanceDashboard.js',
            'src/App.js',
            'package.json'
        ]
        
        print("\n📁 Checking frontend structure...")
        for file_path in frontend_files:
            full_path = frontend_dir / file_path
            if full_path.exists():
                print(f"  ✓ {file_path}")
            else:
                warnings.append(f"Frontend file missing: {file_path}")
                print(f"  ⚠ {file_path} - MISSING")
    else:
        warnings.append("Frontend directory not found")
        print("\n⚠ Frontend directory not found")
    
    # Try importing payment deadlines utility
    print("\n🔧 Checking payment deadlines utility...")
    try:
        sys.path.insert(0, str(backend_dir))
        from utils.payment_deadlines import calculate_payment_deadlines
        deadlines = calculate_payment_deadlines('2025-08-29')
        if len(deadlines) > 0:
            print(f"  ✓ Payment deadlines utility working ({len(deadlines)} deadlines)")
        else:
            warnings.append("Payment deadlines utility returned empty list")
            print("  ⚠ Payment deadlines utility returned empty list")
    except Exception as e:
        errors.append(f"Payment deadlines utility error: {e}")
        print(f"  ✗ Payment deadlines utility error: {e}")
    
    # Check SQL files
    print("\n📄 Checking SQL schema files...")
    sql_files = [
        'sql/create_source_db1.sql',
        'sql/create_data_warehouse.sql'
    ]
    for sql_file in sql_files:
        full_path = backend_dir / sql_file
        if full_path.exists():
            # Check if it contains payment tracking fields
            content = full_path.read_text(encoding='utf-8')
            if 'payment_timestamp' in content or 'PaymentTimestamp' in content:
                print(f"  ✓ {sql_file} - Contains payment tracking")
            else:
                warnings.append(f"{sql_file} may not have payment tracking fields")
                print(f"  ⚠ {sql_file} - May need payment tracking fields")
        else:
            warnings.append(f"SQL file missing: {sql_file}")
            print(f"  ⚠ {sql_file} - MISSING")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    if errors:
        print(f"\n❌ ERRORS FOUND: {len(errors)}")
        for error in errors:
            print(f"  - {error}")
    else:
        print("\n✓ No critical errors found")
    
    if warnings:
        print(f"\n⚠ WARNINGS: {len(warnings)}")
        for warning in warnings:
            print(f"  - {warning}")
    else:
        print("\n✓ No warnings")
    
    print("\n" + "=" * 60)
    
    return len(errors) == 0

if __name__ == '__main__':
    success = check_imports()
    sys.exit(0 if success else 1)

