from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import create_engine, text
import pandas as pd
import numpy as np
from datetime import datetime
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from rbac import Role, Resource, Permission, has_permission
from ml_models import MultiModelPredictor
import os
from datetime import datetime
from pathlib import Path
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
from db_engines import get_dw_engine
from api.prediction_formatting import (
    build_prediction_payload,
    enrich_model_prediction_block,
    fetch_student_profile,
    resolve_student_identifier,
)

try:
    from audit_log import log as audit_log
except ImportError:
    audit_log = None

predictions_bp = Blueprint('predictions', __name__, url_prefix='/api/predictions')

predictor = MultiModelPredictor()
try:
    predictor.load_models()
except:
    print("Models not loaded. Train models first.")

@predictions_bp.route('/model-status', methods=['GET'])
@jwt_required()
def model_status():
    claims = get_jwt()
    role_str = (claims.get('role') or '').strip().lower()
    if role_str not in ('sysadmin', 'admin', 'analyst'):
        return jsonify({'error': 'Permission denied'}), 403

    backend_dir = Path(__file__).resolve().parent.parent
    models_dir = backend_dir / 'models'
    files = {
        'multi_model_predictor.pkl': models_dir / 'multi_model_predictor.pkl',
        'enhanced_predictor.pkl': models_dir / 'enhanced_predictor.pkl',
    }

    def _file_meta(p: Path):
        try:
            st = p.stat()
            return {
                'exists': True,
                'size_bytes': int(st.st_size),
                'modified_iso': datetime.fromtimestamp(st.st_mtime).isoformat(),
            }
        except Exception:
            return {'exists': False}

    return jsonify({
        'env': {
            'render_service_id': os.environ.get('RENDER_SERVICE_ID', ''),
            'render_instance_id': os.environ.get('RENDER_INSTANCE_ID', ''),
        },
        'artifacts': {k: _file_meta(v) for k, v in files.items()},
        'loaded': {
            'standard_models': {
                k: (v is not None) for k, v in (predictor.models or {}).items()
            },
            'enhanced_models': (
                {k: (v is not None) for k, v in (enhanced_predictor.models or {}).items()}
                if enhanced_predictor else None
            ),
        }
    }), 200

def safe_float(value, default=0.0):
    if pd.isna(value) or value is None:
        return default
    if isinstance(value, str):
        try:
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

def _days_since_payment_to_float(val, default=45.0):
    if val is None:
        return default
    if isinstance(val, float) and pd.isna(val):
        return default
    if hasattr(val, 'days'):
        try:
            return float(val.days)
        except (TypeError, ValueError):
            return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default

def apply_scenario_to_tuition_feature_row(
    student_features: pd.DataFrame,
    modified_payment_rate: float,
    modified_attendance_rate: float,
    modified_courses: int,
    has_significant_balance: bool,
    base_payment_rate: float,
    base_attendance_rate: float,
    base_courses: int,
) -> pd.DataFrame:
    mf = student_features.copy()
    tr = safe_float(mf['total_required'].iloc[0], 0.0)

    if tr > 1e-6:
        new_paid = tr * (modified_payment_rate / 100.0)
        mf['total_paid'] = new_paid
        mf['total_pending'] = max(0.0, tr - new_paid)
    mf['payment_completion_rate'] = modified_payment_rate

    bcp = safe_float(mf['completed_payments'].iloc[0], 0.0)
    bpp = safe_float(mf['pending_payments'].iloc[0], 0.0)
    if base_payment_rate > 1e-6:
        mf['completed_payments'] = max(0.0, bcp * (modified_payment_rate / base_payment_rate))
    else:
        mf['completed_payments'] = max(0.0, bcp + modified_payment_rate / 15.0)
    if base_payment_rate < 99.9:
        denom = max(100.0 - base_payment_rate, 1e-6)
        mf['pending_payments'] = max(0.0, bpp * ((100.0 - modified_payment_rate) / denom))
    else:
        mf['pending_payments'] = max(0.0, bpp * ((100.0 - modified_payment_rate) / 100.0))

    dsl = _days_since_payment_to_float(mf['days_since_last_payment'].iloc[0])
    if modified_payment_rate >= 92:
        mf['days_since_last_payment'] = max(0.0, dsl * 0.2)
    elif modified_payment_rate <= 38:
        mf['days_since_last_payment'] = dsl * 1.35 + 40.0
    else:
        mf['days_since_last_payment'] = max(0.0, dsl)

    mf['has_significant_balance'] = 1 if has_significant_balance else 0

    base_ar = max(base_attendance_rate, 1.0)
    ar_scale = modified_attendance_rate / base_ar
    ar_scale = max(0.28, min(3.2, ar_scale))

    base_h = safe_float(mf['total_attendance_hours'].iloc[0], 0.0)
    tdp = safe_float(mf['total_days_present'].iloc[0], 0.0)
    mf['attendance_rate'] = modified_attendance_rate
    mf['total_attendance_hours'] = base_h * ar_scale
    mf['total_days_present'] = tdp * ar_scale
    mf['courses_attended'] = int(max(0, modified_courses))

    mc = max(int(modified_courses), 1)
    mf['avg_hours_per_course'] = (base_h * ar_scale) / float(mc)

    mf['attendance_payment_score'] = (modified_attendance_rate * modified_payment_rate) / 100.0

    return mf

def ensure_tuition_feature_columns_for_scenario(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if 'attendance_payment_score' not in out.columns:
        ar = safe_float(out['attendance_rate'].iloc[0], 0.0)
        pr = safe_float(out['payment_completion_rate'].iloc[0], 0.0)
        out['attendance_payment_score'] = (ar * pr) / 100.0
    return out

def predict_tuition_attendance_from_feature_row(enhanced_predictor, feature_df: pd.DataFrame):
    if not enhanced_predictor or 'tuition_attendance_performance' not in (enhanced_predictor.models or {}):
        return None
    if 'tuition_attendance_performance' not in (enhanced_predictor.feature_cols or {}):
        return None
    feature_cols = enhanced_predictor.feature_cols['tuition_attendance_performance']
    missing = set(feature_cols) - set(feature_df.columns)
    if missing:
        print(f"Tuition scenario prediction missing columns: {missing}")
        return None
    try:
        X_df = feature_df[feature_cols].copy()
        for col in X_df.columns:
            X_df[col] = pd.to_numeric(X_df[col], errors='coerce').fillna(0)
        X = X_df.values.astype(np.float64)
        scaler = enhanced_predictor.scalers.get('tuition_attendance_performance')
        model = enhanced_predictor.models.get('tuition_attendance_performance')
        if not scaler or model is None:
            return None
        X_scaled = scaler.transform(X)
        pred = model.predict(X_scaled)[0]
        return safe_float(pred, 0.0)
    except Exception as ex:
        print(f"predict_tuition_attendance_from_feature_row: {ex}")
        return None

def _norm_scope_id(value):
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None

def ensure_prediction_scope_dean_hod(user_scope, resolved_student_id: str):
    role = user_scope['role']
    if role not in (Role.DEAN, Role.HOD):
        return None
    prof = fetch_student_profile(resolved_student_id)
    student_faculty_id = _norm_scope_id(prof.get('faculty_id'))
    student_dept_id = _norm_scope_id(prof.get('department_id'))

    if role == Role.DEAN:
        user_fid = _norm_scope_id(user_scope.get('faculty_id'))
        if not user_fid:
            return (
                jsonify(
                    {
                        'error': 'Your account is not linked to a faculty. Please contact an administrator.',
                    }
                ),
                403,
            )
        if not student_faculty_id or student_faculty_id != user_fid:
            return (
                jsonify(
                    {
                        'error': (
                            'This student is not in your faculty or in a department under your faculty. '
                            'Please try again with a student whose program belongs to your faculty.'
                        ),
                    }
                ),
                403,
            )
        return None

    if role == Role.HOD:
        user_did = _norm_scope_id(user_scope.get('department_id'))
        if not user_did:
            return (
                jsonify(
                    {
                        'error': 'Your account is not linked to a department. Please contact an administrator.',
                    }
                ),
                403,
            )
        if not student_dept_id or student_dept_id != user_did:
            return (
                jsonify(
                    {
                        'error': (
                            'This student is not in your department. '
                            'Please try again with a student whose program belongs to your department.'
                        ),
                    }
                ),
                403,
            )
    return None

def get_user_scope(claims):
    role_str = claims.get('role', 'student')
    try:
        if isinstance(role_str, str):
            role = Role(role_str.lower())
        else:
            role = role_str
    except (ValueError, AttributeError):
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
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        data = request.get_json()
        
        if not has_permission(user_scope['role'], Resource.PREDICTIONS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
        
        student_id = data.get('student_id') or data.get('access_number') or data.get('reg_number')
        model_type = data.get('model_type', 'ensemble')
        
        if not student_id:
            return jsonify({'error': 'Student ID, Access Number, or Reg Number required'}), 400
        
        resolved = resolve_student_identifier(student_id)
        if not resolved:
            return jsonify({'error': 'Student not found'}), 404
        
        if user_scope['role'] == Role.STUDENT:
            uid = user_scope.get('student_id')
            uacc = user_scope.get('access_number')
            prof = fetch_student_profile(resolved)
            match_sid = bool(uid and str(resolved).strip() == str(uid).strip())
            acc = prof.get('access_number')
            match_acc = bool(
                uacc and acc is not None and str(acc).strip() == str(uacc).strip()
            )
            if not (match_sid or match_acc):
                return jsonify({'error': 'Permission denied: Can only predict own performance'}), 403
        
        denied = ensure_prediction_scope_dean_hod(user_scope, resolved)
        if denied is not None:
            return denied

        prediction = predictor.predict(resolved, model_type)
        if audit_log:
            audit_log('prediction', 'predictions', username=claims.get('username') or claims.get('access_number') or '', role_name=claims.get('role') or '', resource_id=str(resolved), status='success')
        payload = build_prediction_payload(
            student_id_resolved=resolved,
            raw_percent=float(prediction),
            model_type=model_type,
        )
        return jsonify(payload), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@predictions_bp.route('/scenario', methods=['POST'])
@jwt_required()
def predict_scenario():
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        data = request.get_json()
        
        if user_scope['role'] not in [Role.ANALYST, Role.SYSADMIN, Role.SENATE]:
            return jsonify({'error': 'Permission denied: Scenario analysis not allowed'}), 403
        
        student_id = data.get('student_id') or data.get('access_number')
        scenario_params = data.get('scenario', {})
        
        if not student_id:
            return jsonify({'error': 'Student ID or Access Number required'}), 400
        
        resolved = resolve_student_identifier(student_id)
        if not resolved:
            return jsonify({'error': 'Student not found'}), 404
        student_id = resolved
        
        engine = get_dw_engine()
        query = text("""
        WITH
        s AS (
            SELECT ds.student_id
            FROM dim_student ds
            WHERE ds.student_id = :student_id
        ),
        pay AS (
            SELECT
                fp.student_id,
                COALESCE(SUM(CASE WHEN fp.status IN ('Completed','SUCCESS','Paid') THEN fp.amount ELSE 0 END), 0) AS total_paid,
                COALESCE(SUM(CASE WHEN fp.status IN ('Pending','FAILED') THEN fp.amount ELSE 0 END), 0) AS total_pending,
                COALESCE(SUM(fp.amount), 0) AS total_required,
                CASE
                    WHEN COALESCE(SUM(fp.amount), 0) > 0
                        THEN COALESCE(SUM(CASE WHEN fp.status IN ('Completed','SUCCESS','Paid') THEN fp.amount ELSE 0 END), 0)::numeric
                             / COALESCE(SUM(fp.amount), 0)::numeric * 100
                    ELSE 0
                END AS payment_completion_rate,
                COUNT(*) FILTER (WHERE fp.status IN ('Completed','SUCCESS','Paid')) AS completed_payments,
                COUNT(*) FILTER (WHERE fp.status IN ('Pending','FAILED')) AS pending_payments,
                CURRENT_DATE - MAX(
                    CASE
                        WHEN fp.status IN ('Completed','SUCCESS','Paid')
                            THEN TO_DATE(fp.date_key, 'YYYYMMDD')
                        ELSE NULL
                    END
                ) AS days_since_last_payment,
                CASE
                    WHEN COALESCE(SUM(CASE WHEN fp.status IN ('Pending','FAILED') THEN fp.amount ELSE 0 END), 0) > 500000
                        THEN 1
                    ELSE 0
                END AS has_significant_balance
            FROM fact_payment fp
            WHERE fp.student_id = :student_id
            GROUP BY fp.student_id
        ),
        att AS (
            SELECT
                fa.student_id,
                COALESCE(SUM(fa.total_hours), 0) AS total_attendance_hours,
                COALESCE(SUM(fa.days_present), 0) AS total_days_present,
                COALESCE(COUNT(DISTINCT fa.course_code), 0) AS courses_attended,
                CASE
                    WHEN COUNT(*) > 0
                        THEN (SUM(fa.days_present)::numeric / COUNT(*)::numeric) * 100
                    ELSE 0
                END AS attendance_rate,
                COALESCE(AVG(fa.total_hours), 0) AS avg_hours_per_course
            FROM fact_attendance fa
            WHERE fa.student_id = :student_id
            GROUP BY fa.student_id
        )
        SELECT
            s.student_id,
            COALESCE(pay.total_paid, 0) AS total_paid,
            COALESCE(pay.total_pending, 0) AS total_pending,
            COALESCE(pay.total_required, 0) AS total_required,
            COALESCE(pay.payment_completion_rate, 0) AS payment_completion_rate,
            COALESCE(pay.completed_payments, 0) AS completed_payments,
            COALESCE(pay.pending_payments, 0) AS pending_payments,
            pay.days_since_last_payment,
            COALESCE(pay.has_significant_balance, 0) AS has_significant_balance,
            COALESCE(att.total_attendance_hours, 0) AS total_attendance_hours,
            COALESCE(att.total_days_present, 0) AS total_days_present,
            COALESCE(att.courses_attended, 0) AS courses_attended,
            COALESCE(att.attendance_rate, 0) AS attendance_rate,
            COALESCE(att.avg_hours_per_course, 0) AS avg_hours_per_course
        FROM s
        LEFT JOIN pay ON pay.student_id = s.student_id
        LEFT JOIN att ON att.student_id = s.student_id
        """)
        
        student_features = pd.read_sql_query(query, engine, params={'student_id': student_id})
        
        if student_features.empty:
            return jsonify({'error': 'Student data not found'}), 404
        
        base_payment_rate = safe_float(student_features['payment_completion_rate'].iloc[0], 0.0)
        base_attendance_rate = safe_float(student_features['attendance_rate'].iloc[0], 0.0)
        base_courses = safe_int(student_features['courses_attended'].iloc[0], 0)
        
        modified_payment_rate = safe_float(
            scenario_params.get('payment_completion_rate', base_payment_rate), base_payment_rate
        )
        modified_attendance_rate = safe_float(
            scenario_params.get('attendance_rate', base_attendance_rate), base_attendance_rate
        )
        modified_payment_rate = max(0.0, min(100.0, modified_payment_rate))
        modified_attendance_rate = max(0.0, min(100.0, modified_attendance_rate))
        
        courses_change = scenario_params.get('courses_enrolled', 0)
        if isinstance(courses_change, str):
            if courses_change.startswith('+'):
                modified_courses = base_courses + int(courses_change[1:])
            elif courses_change.startswith('-'):
                modified_courses = max(0, base_courses - int(courses_change[1:]))
            elif courses_change == 'optimal':
                modified_courses = min(base_courses + 2, 8)
            else:
                modified_courses = base_courses
        else:
            modified_courses = courses_change if courses_change > 0 else base_courses
        
        has_significant_balance = scenario_params.get('has_significant_balance', 
                                                      bool(student_features['has_significant_balance'].iloc[0]))
        
        predictions = {}
        raw_by_model = {}
        scenario_signal = None

        student_features = ensure_tuition_feature_columns_for_scenario(student_features)

        if enhanced_predictor and 'tuition_attendance_performance' in enhanced_predictor.models:
            try:
                pred_base_tuition = predict_tuition_attendance_from_feature_row(
                    enhanced_predictor, student_features
                )
                modified_features = apply_scenario_to_tuition_feature_row(
                    student_features,
                    modified_payment_rate,
                    modified_attendance_rate,
                    modified_courses,
                    has_significant_balance,
                    base_payment_rate,
                    base_attendance_rate,
                    base_courses,
                )
                pred_scenario_tuition = predict_tuition_attendance_from_feature_row(
                    enhanced_predictor, modified_features
                )
                if pred_base_tuition is not None and pred_scenario_tuition is not None:
                    scenario_signal = pred_scenario_tuition - pred_base_tuition
                    raw_by_model['tuition_attendance_performance'] = pred_scenario_tuition
                    predictions['tuition_attendance_performance'] = {
                        **enrich_model_prediction_block(pred_scenario_tuition),
                    }
            except Exception as e:
                print(f"Error in tuition-attendance scenario prediction: {e}")

        d_att = modified_attendance_rate - base_attendance_rate
        d_pay = modified_payment_rate - base_payment_rate
        d_crs = modified_courses - base_courses
        model_scenario_blend = {
            'random_forest': 1.0,
            'gradient_boosting': 1.0,
            'neural_network': 1.0,
        }
        for model_type in ['random_forest', 'gradient_boosting', 'neural_network']:
            try:
                base_pred = predictor.predict(student_id, model_type)
                if scenario_signal is not None:
                    adjusted_pred = base_pred + scenario_signal * model_scenario_blend[model_type]
                else:
                    attendance_factor = d_att * 0.68
                    payment_factor = d_pay * 0.55
                    courses_factor = d_crs * 1.15
                    if model_type == 'neural_network':
                        attendance_factor *= 1.12
                        payment_factor *= 1.12
                    adjusted_pred = (
                        base_pred + attendance_factor + payment_factor + courses_factor
                    )
                    if has_significant_balance:
                        adjusted_pred -= 12.0

                adjusted_pred = max(0.0, min(100.0, adjusted_pred))
                pred_float = safe_float(adjusted_pred, 0.0)
                raw_by_model[model_type] = pred_float
                predictions[model_type] = {
                    **enrich_model_prediction_block(pred_float),
                }
            except Exception as e:
                print(f"Error in {model_type} scenario prediction: {e}")
        
        if raw_by_model:
            avg_raw = sum(raw_by_model.values()) / len(raw_by_model)
            predictions['ensemble'] = {
                **enrich_model_prediction_block(avg_raw),
            }
        
        scenario_description = {
            'name': 'Custom Scenario',
            'description': (
                f'Modified: Attendance={modified_attendance_rate:.1f}%, '
                f'Payment={modified_payment_rate:.1f}%, course load adjusted'
            ),
        }
        
        if audit_log:
            audit_log('scenario_analysis', 'predictions', username=claims.get('username') or claims.get('access_number') or '', role_name=claims.get('role') or '', resource_id=str(student_id), status='success')
        prof = fetch_student_profile(student_id)
        scenario_body = {
            'scenario': {
                **scenario_description,
                'parameters': {
                    'attendance_rate': modified_attendance_rate,
                    'payment_completion_rate': modified_payment_rate,
                    'courses_enrolled': modified_courses,
                    'has_significant_balance': has_significant_balance
                }
            },
            'student_id': student_id,
            'predictions': predictions,
            'analysis': analyze_scenario(scenario_params, predictions),
            'student': prof,
            'student_name': prof.get('student_name'),
            'access_number': prof.get('access_number'),
            'reg_number': prof.get('reg_number'),
            'faculty_name': prof.get('faculty_name'),
            'department_name': prof.get('department_name'),
            'program_name': prof.get('program_name'),
        }
        return jsonify(scenario_body), 200
        
    except Exception as e:
        import traceback
        print(f"Scenario prediction error: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@predictions_bp.route('/batch-predict', methods=['POST'])
@jwt_required()
def batch_predict():
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        data = request.get_json()
        
        if user_scope['role'] == Role.STUDENT:
            return jsonify({'error': 'Permission denied'}), 403
        
        student_ids = data.get('student_ids', [])
        model_type = data.get('model_type', 'ensemble')
        filters = data.get('filters', {})
        
        engine = get_dw_engine()
        
        if user_scope['role'] == Role.STAFF:
            query = text("""
            SELECT DISTINCT fe.student_id 
            FROM fact_enrollment fe
            JOIN fact_attendance fa ON fe.student_id = fa.student_id
            WHERE fa.staff_id = :staff_id
            """)
            allowed_students = pd.read_sql_query(query, engine, params={'staff_id': user_scope['staff_id']})
            student_ids = [s for s in student_ids if s in allowed_students['student_id'].tolist()]
        
        elif user_scope['role'] == Role.HOD:
            query = text("""
            SELECT DISTINCT ds.student_id
            FROM dim_student ds
            JOIN dim_program dp ON ds.program_id = dp.program_id
            WHERE dp.department_id = :department_id
            """)
            allowed_students = pd.read_sql_query(query, engine, params={'department_id': user_scope['department_id']})
            student_ids = [s for s in student_ids if s in allowed_students['student_id'].tolist()]
        
        elif user_scope['role'] == Role.DEAN:
            query = text("""
            SELECT DISTINCT ds.student_id
            FROM dim_student ds
            JOIN dim_program dp ON ds.program_id = dp.program_id
            JOIN dim_department ddept ON dp.department_id = ddept.department_id
            WHERE ddept.faculty_id = :faculty_id
            """)
            allowed_students = pd.read_sql_query(query, engine, params={'faculty_id': user_scope['faculty_id']})
            student_ids = [s for s in student_ids if s in allowed_students['student_id'].tolist()]
        
        
        results = []
        for student_id in student_ids:
            try:
                resolved = resolve_student_identifier(str(student_id))
                if not resolved:
                    results.append({
                        'student_id': student_id,
                        'error': 'Student not found',
                    })
                    continue
                prediction = predictor.predict(resolved, model_type)
                row = build_prediction_payload(
                    student_id_resolved=resolved,
                    raw_percent=float(prediction),
                    model_type=model_type,
                )
                results.append(row)
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

def analyze_scenario(scenario, predictions):
    analysis = {
        'risk_level': 'medium',
        'recommendations': [],
        'key_factors': []
    }
    
    if not predictions:
        analysis['risk_level'] = 'unknown'
        analysis['recommendations'].append('Unable to generate predictions. Please check model availability.')
        return analysis
    
    avg_prediction = sum([p['predicted_grade'] for p in predictions.values()]) / len(predictions)
    
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
    
    if len(predictions) > 1:
        model_scores = [p['predicted_grade'] for p in predictions.values()]
        score_range = max(model_scores) - min(model_scores)
        if score_range > 15:
            analysis['key_factors'].append('High prediction variance - model uncertainty')
            analysis['recommendations'].append('Gather more data to improve prediction accuracy')
    
    if not analysis['recommendations']:
        analysis['recommendations'].append('Continue monitoring student progress')
    
    return analysis

@predictions_bp.route('/tuition-attendance-performance', methods=['POST'])
@jwt_required()
def predict_tuition_attendance_performance():
    try:
        claims = get_jwt()
        user_scope = get_user_scope(claims)
        
        if not has_permission(user_scope['role'], Resource.PREDICTIONS, Permission.READ, user_scope):
            return jsonify({'error': 'Permission denied'}), 403
        
        if not enhanced_predictor or 'tuition_attendance_performance' not in enhanced_predictor.models:
            return jsonify({'error': 'Model not trained. Please train the tuition-attendance-performance model first.'}), 503
        
        data = request.get_json()
        student_id = data.get('student_id') or data.get('access_number') or data.get('reg_number')
        
        if not student_id:
            return jsonify({'error': 'Student ID or Access Number required'}), 400
        
        resolved = resolve_student_identifier(str(student_id))
        if not resolved:
            return jsonify({'error': 'Student not found'}), 404
        
        if user_scope['role'] == Role.STUDENT:
            uid = user_scope.get('student_id')
            uacc = user_scope.get('access_number')
            prof = fetch_student_profile(resolved)
            match_sid = bool(uid and str(resolved).strip() == str(uid).strip())
            acc = prof.get('access_number')
            match_acc = bool(
                uacc and acc is not None and str(acc).strip() == str(uacc).strip()
            )
            if not (match_sid or match_acc):
                return jsonify({'error': 'Permission denied: Can only predict own performance'}), 403
        
        denied = ensure_prediction_scope_dean_hod(user_scope, resolved)
        if denied is not None:
            return denied

        engine = get_dw_engine()
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
            CURRENT_DATE - MAX(CASE WHEN fp.status = 'Completed' THEN TO_DATE(fp.date_key, 'YYYYMMDD') ELSE NULL END) as days_since_last_payment,
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
        WHERE ds.student_id = :student_id
        GROUP BY ds.student_id
        """)
        
        student_data = pd.read_sql_query(query, engine, params={'student_id': resolved})
        
        if student_data.empty:
            return jsonify({'error': 'Student not found'}), 404
        
        feature_cols = enhanced_predictor.feature_cols['tuition_attendance_performance']
        
        missing_cols = set(feature_cols) - set(student_data.columns)
        if missing_cols:
            print(f"Warning: Missing columns in prediction data: {missing_cols}")
            for col in missing_cols:
                student_data[col] = 0
        
        X_df = student_data[feature_cols].copy()
        for col in X_df.columns:
            X_df[col] = pd.to_numeric(X_df[col], errors='coerce').fillna(0)
        X = X_df.values.astype(np.float64)
        
        scaler = enhanced_predictor.scalers['tuition_attendance_performance']
        X_scaled = scaler.transform(X)
        model = enhanced_predictor.models['tuition_attendance_performance']
        prediction = model.predict(X_scaled)[0]
        
        pred_float = safe_float(prediction, 0.0)
        
        payment_completion = safe_float(student_data['payment_completion_rate'].iloc[0], 0.0)
        attendance_rate = safe_float(student_data['attendance_rate'].iloc[0], 0.0)
        
        attendance_rate = min(100.0, max(0.0, attendance_rate))
        
        total_attendance_records = safe_float(student_data.get('total_attendance_records', pd.Series([0])).iloc[0], 0.0)
        total_days_present = safe_float(student_data.get('total_days_present', pd.Series([0])).iloc[0], 0.0)
        
        if total_attendance_records == 0:
            attendance_rate = 0.0
        else:
            calculated_rate = (total_days_present / total_attendance_records) * 100 if total_attendance_records > 0 else 0.0
            attendance_rate = min(100.0, max(0.0, calculated_rate))
        
        total_paid = safe_float(student_data.get('total_paid', pd.Series([0])).iloc[0], 0.0)
        total_required = safe_float(student_data.get('total_required', pd.Series([0])).iloc[0], 0.0)
        if total_required == 0 and total_paid == 0:
            payment_completion = 0.0
        
        resolved_id = str(student_data['student_id'].iloc[0])
        extra = {
            'payment_completion_rate': round(payment_completion, 2),
            'attendance_rate': round(attendance_rate, 2),
            'attendance_payment_score': safe_float(student_data['attendance_payment_score'].iloc[0], 0.0),
            'total_paid': round(total_paid, 2),
            'total_required': round(total_required, 2),
            'total_attendance_records': int(total_attendance_records),
        }
        payload = build_prediction_payload(
            student_id_resolved=resolved_id,
            raw_percent=pred_float,
            model_type='tuition_attendance_performance',
            extra=extra,
        )
        return jsonify(payload), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@predictions_bp.route('/enrollment-trend', methods=['POST'])
@jwt_required()
def predict_enrollment_trend():
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
        
        engine = get_dw_engine()
        try:
            pass
        finally:
            pass
        return jsonify({
            'message': 'Enrollment trend prediction',
            'year': year,
            'quarter': quarter,
            'predicted_enrollment': 0
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
