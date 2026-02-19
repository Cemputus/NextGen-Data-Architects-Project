"""
Prediction API with multiple ML models and scenario analysis
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import create_engine, text
import pandas as pd
import numpy as np
from datetime import datetime
# Import from parent directory (backend/)
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from rbac import Role, Resource, Permission, has_permission
from ml_models import MultiModelPredictor
try:
    from enhanced_predictions import EnhancedPredictor
    enhanced_predictor = EnhancedPredictor()
    try:
        enhanced_predictor.load_all_models()
    except:
        print("Enhanced models not loaded. Train models first.")
except ImportError:
    enhanced_predictor = None
    print("Enhanced predictions module not available")
from config import DATA_WAREHOUSE_CONN_STRING

predictions_bp = Blueprint('predictions', __name__, url_prefix='/api/predictions')

# Initialize predictor
predictor = MultiModelPredictor()
try:
    predictor.load_models()
except:
    print("Models not loaded. Train models first.")

def safe_float(value, default=0.0):
    """Safely convert value to float, handling various edge cases"""
    if pd.isna(value) or value is None:
        return default
    if isinstance(value, str):
        # Try to convert string, return default if it fails
        try:
            # Handle common non-numeric strings
            if value.upper() in ['M', 'N/A', 'NULL', 'NONE', '']:
                return default
            return float(value)
        except (ValueError, TypeError):
            return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int(value, default=0):
    """Safely convert value to int"""
    if pd.isna(value) or value is None:
        return default
    if isinstance(value, str):
        try:
            if value.upper() in ['M', 'N/A', 'NULL', 'NONE', '']:
                return default
            return int(float(value))
        except (ValueError, TypeError):
            return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def get_user_scope(claims):
    """Get user's data scope based on role"""
    role_str = claims.get('role', 'student')
    # Convert string role to Role enum, handling both string and enum inputs
    try:
        if isinstance(role_str, str):
            role = Role(role_str.lower())
        else:
            role = role_str
    except (ValueError, AttributeError):
        # Fallback to student if role is invalid
        role = Role.STUDENT
    
    scope = {
        'role': role,
        'student_id': claims.get('student_id'),
        'staff_id': claims.get('staff_id'),
        'department_id': claims.get('department_id'),
        'faculty_id': claims.get('faculty_id'),
        'access_number': claims.get('access_number')
    }
    return scope

@predictions_bp.route('/predict', methods=['POST'])
@jwt_required()
def predict_student_performance():
    """Predict student performance using selected model"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        data = request.get_json()
        
        # Check RBAC permissions
        if not has_permission(user_scope['role'], Resource.PREDICTIONS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
        
        student_id = data.get('student_id') or data.get('access_number') or data.get('reg_number')
        model_type = data.get('model_type', 'ensemble')  # 'random_forest', 'gradient_boosting', 'neural_network', 'ensemble'
        
        # Check scope permissions
        if user_scope['role'] == Role.STUDENT:
            # Students can only predict their own performance
            if user_scope['access_number'] and student_id != user_scope['access_number']:
                return jsonify({'error': 'Permission denied: Can only predict own performance'}), 403
            if user_scope['student_id'] and student_id != user_scope['student_id']:
                return jsonify({'error': 'Permission denied: Can only predict own performance'}), 403
        
        if not student_id:
            return jsonify({'error': 'Student ID, Access Number, or Reg Number required'}), 400
        
        # Resolve student_id if access_number or reg_number provided
        if student_id.startswith('A') or student_id.startswith('B'):
            engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
            result = pd.read_sql_query(
                text("SELECT student_id FROM dim_student WHERE access_number = :access_number"),
                engine,
                params={'access_number': student_id}
            )
            if not result.empty:
                student_id = result['student_id'].iloc[0]
            engine.dispose()
        
        prediction = predictor.predict(student_id, model_type)
        
        return jsonify({
            'student_id': student_id,
            'model_type': model_type,
            'predicted_grade': round(float(prediction), 2),
            'predicted_letter_grade': get_letter_grade(prediction)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@predictions_bp.route('/scenario', methods=['POST'])
@jwt_required()
def predict_scenario():
    """Predict performance for a hypothetical scenario (what-if analysis)"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        data = request.get_json()
        
        # Check permissions - only analysts, sysadmin, and senate can do scenario analysis
        if user_scope['role'] not in [Role.ANALYST, Role.SYSADMIN, Role.SENATE]:
            return jsonify({'error': 'Permission denied: Scenario analysis not allowed'}), 403
        
        # Get student_id and scenario parameters
        student_id = data.get('student_id') or data.get('access_number')
        scenario_params = data.get('scenario', {})
        
        if not student_id:
            return jsonify({'error': 'Student ID or Access Number required'}), 400
        
        # Resolve student_id if access_number provided
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        if student_id.startswith('A') or student_id.startswith('B'):
            result = pd.read_sql_query(
                text("SELECT student_id FROM dim_student WHERE access_number = :access_number"),
                engine,
                params={'access_number': student_id}
            )
            if not result.empty:
                student_id = result['student_id'].iloc[0]
            else:
                engine.dispose()
                return jsonify({'error': 'Student not found'}), 404
        
        # Get base student features (tuition and attendance data)
        query = text("""
        SELECT 
            ds.student_id,
            COALESCE(SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END), 0) as total_pending,
            COALESCE(SUM(fp.amount), 0) as total_required,
            CASE 
                WHEN SUM(fp.amount) > 0 
                THEN SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) / SUM(fp.amount) * 100
                ELSE 0 
            END as payment_completion_rate,
            COUNT(CASE WHEN fp.status = 'Completed' THEN 1 END) as completed_payments,
            COUNT(CASE WHEN fp.status = 'Pending' THEN 1 END) as pending_payments,
            DATEDIFF(CURDATE(), MAX(CASE WHEN fp.status = 'Completed' THEN fp.date_key ELSE NULL END)) as days_since_last_payment,
            CASE 
                WHEN SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END) > 500000 
                THEN 1 ELSE 0 
            END as has_significant_balance,
            COALESCE(SUM(fa.total_hours), 0) as total_attendance_hours,
            COALESCE(SUM(fa.days_present), 0) as total_days_present,
            COALESCE(COUNT(DISTINCT fa.course_code), 0) as courses_attended,
            CASE 
                WHEN COUNT(fa.attendance_id) > 0 
                THEN (SUM(fa.days_present) / COUNT(fa.attendance_id)) * 100
                ELSE 0 
            END as attendance_rate,
            AVG(fa.total_hours) as avg_hours_per_course
        FROM dim_student ds
        LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
        LEFT JOIN fact_attendance fa ON ds.student_id = fa.student_id
        WHERE ds.student_id = :student_id
        GROUP BY ds.student_id
        """)
        
        student_features = pd.read_sql_query(query, engine, params={'student_id': student_id})
        engine.dispose()
        
        if student_features.empty:
            return jsonify({'error': 'Student data not found'}), 404
        
        # Apply scenario parameters to modify features
        # Safely convert to numeric, handling NaN, None, and string values
        def safe_float(value, default=0.0):
            """Safely convert value to float, handling various edge cases"""
            if pd.isna(value) or value is None:
                return default
            if isinstance(value, str):
                # Try to convert string, return default if it fails
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default
        
        def safe_int(value, default=0):
            """Safely convert value to int"""
            if pd.isna(value) or value is None:
                return default
            if isinstance(value, str):
                try:
                    return int(float(value))
                except (ValueError, TypeError):
                    return default
            try:
                return int(value)
            except (ValueError, TypeError):
                return default
        
        base_payment_rate = safe_float(student_features['payment_completion_rate'].iloc[0], 0.0)
        base_attendance_rate = safe_float(student_features['attendance_rate'].iloc[0], 0.0)
        base_courses = safe_int(student_features['courses_attended'].iloc[0], 0)
        
        # Override with scenario parameters if provided
        modified_payment_rate = scenario_params.get('payment_completion_rate', base_payment_rate)
        modified_attendance_rate = scenario_params.get('attendance_rate', base_attendance_rate)
        
        # Handle courses_enrolled changes
        courses_change = scenario_params.get('courses_enrolled', 0)
        if isinstance(courses_change, str):
            if courses_change.startswith('+'):
                modified_courses = base_courses + int(courses_change[1:])
            elif courses_change.startswith('-'):
                modified_courses = max(0, base_courses - int(courses_change[1:]))
            elif courses_change == 'optimal':
                modified_courses = min(base_courses + 2, 8)  # Optimal is slightly more courses
            else:
                modified_courses = base_courses
        else:
            modified_courses = courses_change if courses_change > 0 else base_courses
        
        # Handle has_significant_balance
        has_significant_balance = scenario_params.get('has_significant_balance', 
                                                      bool(student_features['has_significant_balance'].iloc[0]))
        
        # Prepare modified feature vector for prediction
        # Use tuition-attendance model if available, otherwise use standard models
        predictions = {}
        
        # Try tuition-attendance model first (most accurate for scenario analysis)
        if enhanced_predictor and 'tuition_attendance_performance' in enhanced_predictor.models:
            try:
                # Create modified feature vector
                modified_features = student_features.copy()
                modified_features['payment_completion_rate'] = modified_payment_rate
                modified_features['attendance_rate'] = modified_attendance_rate
                modified_features['courses_attended'] = modified_courses
                modified_features['has_significant_balance'] = 1 if has_significant_balance else 0
                
                # Recalculate derived features
                modified_features['attendance_payment_score'] = (
                    modified_attendance_rate * modified_payment_rate / 100
                )
                
                # Get feature columns and scale
                if 'tuition_attendance_performance' in enhanced_predictor.feature_cols:
                    feature_cols = enhanced_predictor.feature_cols['tuition_attendance_performance']
                    # Ensure all values are numeric before converting to array
                    X_df = modified_features[feature_cols].copy()
                    # Convert all columns to numeric, coercing errors to NaN then filling with 0
                    for col in X_df.columns:
                        X_df[col] = pd.to_numeric(X_df[col], errors='coerce').fillna(0)
                    X = X_df.values.astype(np.float64)
                    
                    scaler = enhanced_predictor.scalers.get('tuition_attendance_performance')
                    if scaler:
                        X_scaled = scaler.transform(X)
                        model = enhanced_predictor.models['tuition_attendance_performance']
                        pred = model.predict(X_scaled)[0]
                        
                        pred_float = safe_float(pred, 0.0)
                        predictions['tuition_attendance_performance'] = {
                            'predicted_grade': round(pred_float, 2),
                            'predicted_letter_grade': get_letter_grade(pred_float)
                        }
            except Exception as e:
                print(f"Error in tuition-attendance scenario prediction: {e}")
        
        # Also run standard models for comparison
        for model_type in ['random_forest', 'gradient_boosting', 'neural_network']:
            try:
                # For standard models, we adjust the prediction based on scenario changes
                base_pred = predictor.predict(student_id, model_type)
                
                # Apply scenario-based adjustments
                # Higher attendance and payment = better performance
                attendance_factor = (modified_attendance_rate - base_attendance_rate) / 100 * 5  # 5 points per 10% change
                payment_factor = (modified_payment_rate - base_payment_rate) / 100 * 3  # 3 points per 10% change
                courses_factor = (modified_courses - base_courses) * 0.5  # 0.5 points per course
                
                adjusted_pred = base_pred + attendance_factor + payment_factor + courses_factor
                
                # If significant balance, reduce prediction
                if has_significant_balance:
                    adjusted_pred -= 5
                
                # Clamp between 0 and 100
                adjusted_pred = max(0, min(100, adjusted_pred))
                
                pred_float = safe_float(adjusted_pred, 0.0)
                predictions[model_type] = {
                    'predicted_grade': round(pred_float, 2),
                    'predicted_letter_grade': get_letter_grade(pred_float)
                }
            except Exception as e:
                print(f"Error in {model_type} scenario prediction: {e}")
        
        # Create ensemble prediction
        if predictions:
            avg_grade = sum([p['predicted_grade'] for p in predictions.values()]) / len(predictions)
            predictions['ensemble'] = {
                'predicted_grade': round(avg_grade, 2),
                'predicted_letter_grade': get_letter_grade(avg_grade)
            }
        
        # Build scenario description
        scenario_description = {
            'name': 'Custom Scenario',
            'description': f'Modified: Attendance={modified_attendance_rate:.1f}%, Payment={modified_payment_rate:.1f}%, Courses={modified_courses}'
        }
        
        return jsonify({
            'scenario': {
                **scenario_description,
                'parameters': {
                    'attendance_rate': modified_attendance_rate,
                    'payment_completion_rate': modified_payment_rate,
                    'courses_enrolled': modified_courses,
                    'has_significant_balance': has_significant_balance
                }
            },
            'predictions': predictions,
            'analysis': analyze_scenario(scenario_params, predictions)
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Scenario prediction error: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@predictions_bp.route('/batch-predict', methods=['POST'])
@jwt_required()
def batch_predict():
    """Batch prediction for multiple students"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        data = request.get_json()
        
        # Check permissions
        if user_scope['role'] == Role.STUDENT:
            return jsonify({'error': 'Permission denied'}), 403
        
        student_ids = data.get('student_ids', [])
        model_type = data.get('model_type', 'ensemble')
        filters = data.get('filters', {})
        
        # Apply role-based filtering
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        if user_scope['role'] == Role.STAFF:
            # Staff can only predict for their classes
            query = text("""
            SELECT DISTINCT fe.student_id 
            FROM fact_enrollment fe
            JOIN fact_attendance fa ON fe.student_id = fa.student_id
            WHERE fa.staff_id = :staff_id
            """)
            allowed_students = pd.read_sql_query(query, engine, params={'staff_id': user_scope['staff_id']})
            student_ids = [s for s in student_ids if s in allowed_students['student_id'].tolist()]
        
        elif user_scope['role'] == Role.HOD:
            # HOD can predict for their department
            query = text("""
            SELECT DISTINCT ds.student_id
            FROM dim_student ds
            JOIN dim_program dp ON ds.program_id = dp.program_id
            WHERE dp.department_id = :department_id
            """)
            allowed_students = pd.read_sql_query(query, engine, params={'department_id': user_scope['department_id']})
            student_ids = [s for s in student_ids if s in allowed_students['student_id'].tolist()]
        
        elif user_scope['role'] == Role.DEAN:
            # Dean can predict for their faculty
            query = text("""
            SELECT DISTINCT ds.student_id
            FROM dim_student ds
            JOIN dim_program dp ON ds.program_id = dp.program_id
            JOIN dim_department ddept ON dp.department_id = ddept.department_id
            WHERE ddept.faculty_id = :faculty_id
            """)
            allowed_students = pd.read_sql_query(query, engine, params={'faculty_id': user_scope['faculty_id']})
            student_ids = [s for s in student_ids if s in allowed_students['student_id'].tolist()]
        
        engine.dispose()
        
        results = []
        for student_id in student_ids:
            try:
                prediction = predictor.predict(student_id, model_type)
                results.append({
                    'student_id': student_id,
                    'predicted_grade': round(float(prediction), 2),
                    'predicted_letter_grade': get_letter_grade(prediction)
                })
            except Exception as e:
                results.append({
                    'student_id': student_id,
                    'error': str(e)
                })
        
        return jsonify({
            'model_type': model_type,
            'total_students': len(student_ids),
            'successful_predictions': len([r for r in results if 'error' not in r]),
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@predictions_bp.route('/scenarios', methods=['GET'])
@jwt_required()
def get_scenario_templates():
    """Get predefined scenario templates"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        scenarios = [
            {
                'id': 'high_attendance',
                'name': 'High Attendance Scenario',
                'description': 'What if student maintains 90%+ attendance?',
                'parameters': {'attendance_rate': 90}
            },
            {
                'id': 'low_attendance',
                'name': 'Low Attendance Scenario',
                'description': 'What if student attendance drops to 50%?',
                'parameters': {'attendance_rate': 50}
            },
            {
                'id': 'full_tuition',
                'name': 'Full Tuition Payment',
                'description': 'What if all tuition is paid on time?',
                'parameters': {'payment_completion_rate': 100}
            },
            {
                'id': 'tuition_arrears',
                'name': 'Tuition Arrears Scenario',
                'description': 'What if student has significant tuition arrears?',
                'parameters': {'payment_completion_rate': 30, 'has_significant_balance': True}
            },
            {
                'id': 'increased_courses',
                'name': 'Increased Course Load',
                'description': 'What if student enrolls in more courses?',
                'parameters': {'courses_enrolled': '+3'}
            },
            {
                'id': 'reduced_courses',
                'name': 'Reduced Course Load',
                'description': 'What if student reduces course load?',
                'parameters': {'courses_enrolled': '-2'}
            },
            {
                'id': 'top_performer',
                'name': 'Top Performer Scenario',
                'description': 'Optimal conditions for best performance',
                'parameters': {
                    'attendance_rate': 95,
                    'payment_completion_rate': 100,
                    'courses_enrolled': 'optimal'
                }
            },
            {
                'id': 'at_risk',
                'name': 'At-Risk Student Scenario',
                'description': 'Multiple risk factors present',
                'parameters': {
                    'attendance_rate': 40,
                    'payment_completion_rate': 20,
                    'has_significant_balance': True
                }
            }
        ]
        
        return jsonify({'scenarios': scenarios}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_letter_grade(score):
    """Convert numeric score to letter grade"""
    if score >= 80:
        return 'A'
    elif score >= 75:
        return 'B+'
    elif score >= 70:
        return 'B'
    elif score >= 60:
        return 'C'
    elif score >= 50:
        return 'D'
    else:
        return 'F'

def analyze_scenario(scenario, predictions):
    """Analyze scenario predictions and provide insights"""
    analysis = {
        'risk_level': 'medium',
        'recommendations': [],
        'key_factors': []
    }
    
    if not predictions:
        analysis['risk_level'] = 'unknown'
        analysis['recommendations'].append('Unable to generate predictions. Please check model availability.')
        return analysis
    
    # Calculate average prediction across all models
    avg_prediction = sum([p['predicted_grade'] for p in predictions.values()]) / len(predictions)
    
    # Determine risk level based on predicted grade
    if avg_prediction < 50:
        analysis['risk_level'] = 'high'
        analysis['recommendations'].append('Student is at high risk of failure. Immediate intervention needed.')
        analysis['recommendations'].append('Consider academic support programs and counseling.')
    elif avg_prediction < 60:
        analysis['risk_level'] = 'medium-high'
        analysis['recommendations'].append('Student needs support to improve performance.')
        analysis['recommendations'].append('Monitor attendance and provide additional tutoring.')
    elif avg_prediction < 70:
        analysis['risk_level'] = 'medium'
        analysis['recommendations'].append('Student is performing adequately but has room for improvement.')
        analysis['recommendations'].append('Encourage consistent attendance and timely fee payment.')
    elif avg_prediction >= 80:
        analysis['risk_level'] = 'low'
        analysis['recommendations'].append('Student is performing excellently. Maintain current strategies.')
        analysis['recommendations'].append('Consider advanced courses or research opportunities.')
    else:
        analysis['risk_level'] = 'low'
        analysis['recommendations'].append('Student is performing well. Continue current approach.')
    
    # Analyze scenario parameters
    attendance_rate = scenario.get('attendance_rate')
    payment_rate = scenario.get('payment_completion_rate')
    has_balance = scenario.get('has_significant_balance', False)
    
    if attendance_rate is not None:
        if attendance_rate < 60:
            analysis['key_factors'].append('Critical: Very low attendance rate')
            analysis['recommendations'].append('URGENT: Implement attendance intervention program')
        elif attendance_rate < 70:
            analysis['key_factors'].append('Low attendance is a major concern')
            analysis['recommendations'].append('Implement attendance monitoring and support')
        elif attendance_rate >= 90:
            analysis['key_factors'].append('Excellent attendance rate')
    
    if payment_rate is not None:
        if payment_rate < 40:
            analysis['key_factors'].append('Critical: Significant tuition arrears')
            analysis['recommendations'].append('URGENT: Financial aid or payment plan needed immediately')
        elif payment_rate < 60:
            analysis['key_factors'].append('Tuition arrears may impact performance')
            analysis['recommendations'].append('Financial aid or payment plan may be needed')
        elif payment_rate >= 90:
            analysis['key_factors'].append('Good tuition payment record')
    
    if has_balance:
        analysis['key_factors'].append('Student has significant outstanding balance')
        analysis['recommendations'].append('Review financial situation and provide payment assistance')
    
    # Performance trend analysis
    if len(predictions) > 1:
        model_scores = [p['predicted_grade'] for p in predictions.values()]
        score_range = max(model_scores) - min(model_scores)
        if score_range > 15:
            analysis['key_factors'].append('High prediction variance - model uncertainty')
            analysis['recommendations'].append('Gather more data to improve prediction accuracy')
    
    # Ensure we have at least one recommendation
    if not analysis['recommendations']:
        analysis['recommendations'].append('Continue monitoring student progress')
    
    return analysis

@predictions_bp.route('/tuition-attendance-performance', methods=['POST'])
@jwt_required()
def predict_tuition_attendance_performance():
    """Predict performance based on tuition timeliness and attendance"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        if not has_permission(user_scope['role'], Resource.PREDICTIONS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
        
        if not enhanced_predictor or 'tuition_attendance_performance' not in enhanced_predictor.models:
            return jsonify({'error': 'Model not trained. Please train the tuition-attendance-performance model first.'}), 503
        
        data = request.get_json()
        student_id = data.get('student_id') or data.get('access_number')
        
        if not student_id:
            return jsonify({'error': 'Student ID or Access Number required'}), 400
        
        # Get student features
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        # Use the same query structure as in enhanced_predictions.py
        query = text("""
        SELECT 
            ds.student_id,
            -- Tuition Features (must match training query exactly)
            COALESCE(SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END), 0) as total_pending,
            COALESCE(SUM(fp.amount), 0) as total_required,
            CASE 
                WHEN SUM(fp.amount) > 0 
                THEN SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) / SUM(fp.amount) * 100
                ELSE 0 
            END as payment_completion_rate,
            COUNT(CASE WHEN fp.status = 'Completed' THEN 1 END) as completed_payments,
            DATEDIFF(CURDATE(), MAX(CASE WHEN fp.status = 'Completed' THEN fp.date_key ELSE NULL END)) as days_since_last_payment,
            CASE 
                WHEN SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END) > 500000 
                THEN 1 ELSE 0 
            END as has_significant_balance,
            -- Attendance Features
            COALESCE(SUM(fa.total_hours), 0) as total_attendance_hours,
            COALESCE(SUM(fa.days_present), 0) as total_days_present,
            COALESCE(COUNT(fa.attendance_id), 0) as total_attendance_records,
            CASE 
                WHEN COUNT(fa.attendance_id) > 0 AND SUM(COALESCE(fa.days_present, 0)) > 0
                THEN LEAST(100.0, (SUM(COALESCE(fa.days_present, 0)) / NULLIF(COUNT(fa.attendance_id), 0)) * 100.0)
                ELSE 0.0 
            END as attendance_rate,
            COALESCE(COUNT(DISTINCT fa.course_code), 0) as courses_attended,
            COALESCE(AVG(fa.total_hours), 0) as avg_hours_per_course,
            -- Combined Features
            CASE 
                WHEN COUNT(fa.attendance_id) > 0 AND SUM(fp.amount) > 0
                THEN ((SUM(fa.days_present) / COUNT(fa.attendance_id)) * 100) * 
                     (SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) / SUM(fp.amount) * 100) / 100
                ELSE 0 
            END as attendance_payment_score
        FROM dim_student ds
        LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
        LEFT JOIN fact_attendance fa ON ds.student_id = fa.student_id
        WHERE ds.student_id = :student_id OR ds.access_number = :student_id
        GROUP BY ds.student_id
        """)
        
        student_data = pd.read_sql_query(query, engine, params={'student_id': student_id})
        engine.dispose()
        
        if student_data.empty:
            return jsonify({'error': 'Student not found'}), 404
        
        # Prepare features - ensure all values are numeric
        feature_cols = enhanced_predictor.feature_cols['tuition_attendance_performance']
        
        # Check for missing columns and add them with default values
        missing_cols = set(feature_cols) - set(student_data.columns)
        if missing_cols:
            print(f"Warning: Missing columns in prediction data: {missing_cols}")
            for col in missing_cols:
                student_data[col] = 0  # Add missing columns with default value 0
        
        X_df = student_data[feature_cols].copy()
        # Convert all columns to numeric, coercing errors to NaN then filling with 0
        for col in X_df.columns:
            X_df[col] = pd.to_numeric(X_df[col], errors='coerce').fillna(0)
        X = X_df.values.astype(np.float64)
        
        # Scale and predict
        scaler = enhanced_predictor.scalers['tuition_attendance_performance']
        X_scaled = scaler.transform(X)
        model = enhanced_predictor.models['tuition_attendance_performance']
        prediction = model.predict(X_scaled)[0]
        
        # Safely convert all values
        pred_float = safe_float(prediction, 0.0)
        
        # Get the actual values and ensure they're properly calculated
        payment_completion = safe_float(student_data['payment_completion_rate'].iloc[0], 0.0)
        attendance_rate = safe_float(student_data['attendance_rate'].iloc[0], 0.0)
        
        # Ensure attendance rate doesn't exceed 100%
        attendance_rate = min(100.0, max(0.0, attendance_rate))
        
        # If there's no attendance data but student exists, set to 0 instead of showing 100%
        total_attendance_records = safe_float(student_data.get('total_attendance_records', pd.Series([0])).iloc[0], 0.0)
        total_days_present = safe_float(student_data.get('total_days_present', pd.Series([0])).iloc[0], 0.0)
        
        # Recalculate attendance rate properly: if no records, it's 0%
        if total_attendance_records == 0:
            attendance_rate = 0.0
        else:
            # Calculate as percentage: (days_present / total_possible_days) * 100
            # Since we don't have total_possible_days, use a more meaningful calculation
            # Attendance rate = (days_present / attendance_records) * 100, capped at 100%
            # But this assumes each record is one day, which might not be accurate
            # For now, use the calculated rate but ensure it's between 0 and 100
            calculated_rate = (total_days_present / total_attendance_records) * 100 if total_attendance_records > 0 else 0.0
            attendance_rate = min(100.0, max(0.0, calculated_rate))
        
        # If there's no payment data, payment completion should be 0, not showing incorrectly
        total_paid = safe_float(student_data.get('total_paid', pd.Series([0])).iloc[0], 0.0)
        total_required = safe_float(student_data.get('total_required', pd.Series([0])).iloc[0], 0.0)
        if total_required == 0 and total_paid == 0:
            payment_completion = 0.0
        
        return jsonify({
            'student_id': student_id,
            'model_type': 'tuition_attendance_performance',
            'predicted_grade': round(pred_float, 2),
            'predicted_letter_grade': get_letter_grade(pred_float),
            'payment_completion_rate': round(payment_completion, 2),
            'attendance_rate': round(attendance_rate, 2),
            'attendance_payment_score': safe_float(student_data['attendance_payment_score'].iloc[0], 0.0),
            'total_paid': round(total_paid, 2),
            'total_required': round(total_required, 2),
            'total_attendance_records': int(total_attendance_records)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@predictions_bp.route('/enrollment-trend', methods=['POST'])
@jwt_required()
def predict_enrollment_trend():
    """Predict enrollment trends for resource allocation"""
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        if user_scope['role'] not in [Role.ANALYST, Role.SYSADMIN, Role.SENATE, Role.DEAN, Role.HOD]:
            return jsonify({'error': 'Permission denied'}), 403
        
        if not enhanced_predictor or 'enrollment_trend' not in enhanced_predictor.models:
            return jsonify({'error': 'Model not trained'}), 503
        
        data = request.get_json()
        year = data.get('year', datetime.now().year + 1)
        quarter = data.get('quarter', 1)
        program_id = data.get('program_id')
        department_id = data.get('department_id')
        faculty_id = data.get('faculty_id')
        
        # Get historical data for lag features
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        # Implementation would fetch historical data and create lag features
        # Then use the model to predict
        
        return jsonify({
            'message': 'Enrollment trend prediction',
            'year': year,
            'quarter': quarter,
            'predicted_enrollment': 0  # Placeholder
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

