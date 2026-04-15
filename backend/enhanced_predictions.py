import pandas as pd
import numpy as np
import pickle
from pathlib import Path
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor, GradientBoostingClassifier
from sklearn.neural_network import MLPRegressor, MLPClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error, accuracy_score, classification_report
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING
from datetime import datetime, timedelta
from db_engines import get_dw_engine

class EnhancedPredictor:
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.label_encoders = {}
        self.model_path = Path(__file__).parent / "models"
        self.model_path.mkdir(parents=True, exist_ok=True)
        self.feature_cols = {}
    
    def prepare_tuition_attendance_features(self):
        engine = get_dw_engine()
        
        # Avoid multi-joining fact tables directly; aggregate first to prevent row explosion/timeouts.
        query = """
        WITH
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
            GROUP BY fa.student_id
        ),
        gr AS (
            SELECT
                fg.student_id,
                AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) AS avg_grade,
                COUNT(*) FILTER (WHERE fg.exam_status = 'Completed') AS completed_exams,
                COUNT(*) FILTER (WHERE fg.exam_status = 'MEX') AS missed_exams,
                COUNT(*) FILTER (WHERE fg.exam_status = 'FEX') AS failed_exams
            FROM fact_grade fg
            GROUP BY fg.student_id
        )
        SELECT
            ds.student_id,
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
            COALESCE(att.avg_hours_per_course, 0) AS avg_hours_per_course,
            CASE
                WHEN COALESCE(att.courses_attended, 0) > 0 AND COALESCE(pay.total_required, 0) > 0
                    THEN (COALESCE(att.attendance_rate, 0) * COALESCE(pay.payment_completion_rate, 0)) / 100
                ELSE 0
            END AS attendance_payment_score,
            gr.avg_grade,
            gr.completed_exams,
            gr.missed_exams,
            gr.failed_exams
        FROM dim_student ds
        LEFT JOIN pay ON pay.student_id = ds.student_id
        LEFT JOIN att ON att.student_id = ds.student_id
        LEFT JOIN gr  ON gr.student_id  = ds.student_id
        WHERE COALESCE(gr.completed_exams, 0) > 0
        """
        
        df = pd.read_sql_query(text(query), engine)
        
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        df[numeric_cols] = df[numeric_cols].fillna(0)
        
        return df
    
    def train_tuition_attendance_model(self):
        print("Training Tuition + Attendance → Performance Model...")
        df = self.prepare_tuition_attendance_features()
        
        feature_cols = [
            'payment_completion_rate', 'total_paid', 'total_pending', 'completed_payments',
            'days_since_last_payment', 'has_significant_balance',
            'attendance_rate', 'total_attendance_hours', 'courses_attended',
            'avg_hours_per_course', 'attendance_payment_score'
        ]
        
        X = df[feature_cols].fillna(0)
        y = df['avg_grade'].fillna(0)
        
        Q1 = y.quantile(0.25)
        Q3 = y.quantile(0.75)
        IQR = Q3 - Q1
        mask = (y >= Q1 - 1.5*IQR) & (y <= Q3 + 1.5*IQR)
        X = X[mask]
        y = y[mask]
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        model = GradientBoostingRegressor(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
        model.fit(X_train_scaled, y_train)
        
        y_pred = model.predict(X_test_scaled)
        r2 = r2_score(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        
        print(f"R² Score: {r2:.4f}, RMSE: {rmse:.2f}")
        
        self.models['tuition_attendance_performance'] = model
        self.scalers['tuition_attendance_performance'] = scaler
        self.feature_cols['tuition_attendance_performance'] = feature_cols
        
        return {'r2': r2, 'rmse': rmse}
    
    def prepare_enrollment_trend_features(self):
        engine = get_dw_engine()
        
        query = """
        SELECT 
            dt.year,
            dt.quarter,
            dp.program_id,
            ddept.department_id,
            df.faculty_id,
            ds.high_school,
            ds.region,
            COUNT(DISTINCT fe.student_id) as enrollment_count,
            COUNT(DISTINCT fe.course_code) as courses_enrolled,
            AVG(dc.credits) as avg_credits,
            COUNT(DISTINCT fe.semester_id) as semesters_count
        FROM fact_enrollment fe
        JOIN dim_time dt ON fe.date_key = dt.date_key
        JOIN dim_student ds ON fe.student_id = ds.student_id
        JOIN dim_program dp ON ds.program_id = dp.program_id
        JOIN dim_department ddept ON dp.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
        LEFT JOIN dim_course dc ON fe.course_code = dc.course_code
        GROUP BY dt.year, dt.quarter, dp.program_id, ddept.department_id, 
                 df.faculty_id, ds.high_school, ds.region
        ORDER BY dt.year, dt.quarter
        """
        
        df = pd.read_sql_query(text(query), engine)
        
        df = df.sort_values(['year', 'quarter', 'program_id'])
        df['enrollment_lag1'] = df.groupby(['program_id', 'quarter'])['enrollment_count'].shift(1)
        df['enrollment_lag2'] = df.groupby(['program_id', 'quarter'])['enrollment_count'].shift(2)
        df['enrollment_ma3'] = df.groupby(['program_id', 'quarter'])['enrollment_count'].rolling(3).mean().reset_index(0, drop=True)
        
        df = df.fillna(0)
        
        return df
    
    def train_enrollment_trend_model(self):
        print("Training Enrollment Trend Prediction Model...")
        df = self.prepare_enrollment_trend_features()
        
        feature_cols = [
            'year', 'quarter', 'program_id', 'department_id', 'faculty_id',
            'enrollment_lag1', 'enrollment_lag2', 'enrollment_ma3',
            'courses_enrolled', 'avg_credits'
        ]
        
        le_program = LabelEncoder()
        le_dept = LabelEncoder()
        le_faculty = LabelEncoder()
        
        df['program_encoded'] = le_program.fit_transform(df['program_id'].astype(str))
        df['dept_encoded'] = le_dept.fit_transform(df['department_id'].astype(str))
        df['faculty_encoded'] = le_faculty.fit_transform(df['faculty_id'].astype(str))
        
        feature_cols_encoded = [
            'year', 'quarter', 'program_encoded', 'dept_encoded', 'faculty_encoded',
            'enrollment_lag1', 'enrollment_lag2', 'enrollment_ma3',
            'courses_enrolled', 'avg_credits'
        ]
        
        X = df[feature_cols_encoded].fillna(0)
        y = df['enrollment_count'].fillna(0)
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
        model.fit(X_train_scaled, y_train)
        
        y_pred = model.predict(X_test_scaled)
        r2 = r2_score(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        
        print(f"R² Score: {r2:.4f}, RMSE: {rmse:.2f}")
        
        self.models['enrollment_trend'] = model
        self.scalers['enrollment_trend'] = scaler
        self.feature_cols['enrollment_trend'] = feature_cols_encoded
        self.label_encoders['enrollment_trend_program'] = le_program
        self.label_encoders['enrollment_trend_dept'] = le_dept
        self.label_encoders['enrollment_trend_faculty'] = le_faculty
        
        return {'r2': r2, 'rmse': rmse}
    
    def prepare_foundational_course_features(self):
        engine = get_dw_engine()
        
        query = """
        SELECT 
            fg.course_code,
            dc.course_name,
            dc.credits,
            CASE WHEN dc.course_level IN ('100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110') THEN 1 ELSE 0 END as is_foundational,
            fg.student_id,
            ds.program_id,
            ds.year_of_study,
            -- Student performance history
            AVG(CASE WHEN fg2.exam_status = 'Completed' THEN fg2.grade ELSE NULL END) as student_avg_grade,
            COUNT(CASE WHEN fg2.exam_status = 'Completed' THEN 1 END) as student_completed_exams,
            -- Course-specific features
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as course_avg_grade,
            COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as course_completed_count,
            COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as course_fex_count,
            COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as course_mex_count,
            -- Attendance for this course
            AVG(fa.total_hours) as course_attendance_hours,
            AVG(fa.days_present) as course_days_present
        FROM fact_grade fg
        JOIN dim_course dc ON fg.course_code = dc.course_code
        JOIN dim_student ds ON fg.student_id = ds.student_id
        LEFT JOIN fact_grade fg2 ON ds.student_id = fg2.student_id AND fg2.course_code != fg.course_code
        LEFT JOIN fact_attendance fa ON fg.student_id = fa.student_id AND fg.course_code = fa.course_code
        WHERE CASE WHEN dc.course_level IN ('100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110') THEN 1 ELSE 0 END = 1
        GROUP BY fg.course_code, dc.course_name, dc.credits, fg.student_id, ds.program_id, ds.year_of_study
        """
        
        df = pd.read_sql_query(text(query), engine)
        
        df['will_pass'] = (df['course_avg_grade'] >= 50).astype(int)
        
        df = df.fillna(0)
        
        return df
    
    def train_foundational_course_model(self):
        print("Training Foundational Course Performance Model...")
        df = self.prepare_foundational_course_features()
        
        feature_cols = [
            'credits', 'is_foundational', 'year_of_study',
            'student_avg_grade', 'student_completed_exams',
            'course_avg_grade', 'course_completed_count',
            'course_fex_count', 'course_mex_count',
            'course_attendance_hours', 'course_days_present'
        ]
        
        le_course = LabelEncoder()
        le_program = LabelEncoder()
        
        df['course_encoded'] = le_course.fit_transform(df['course_code'].astype(str))
        df['program_encoded'] = le_program.fit_transform(df['program_id'].astype(str))
        
        feature_cols_encoded = feature_cols + ['course_encoded', 'program_encoded']
        
        X = df[feature_cols_encoded].fillna(0)
        y = df['will_pass'].fillna(0)
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
        model.fit(X_train_scaled, y_train)
        
        y_pred = model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"Accuracy: {accuracy:.4f}")
        print(classification_report(y_test, y_pred))
        
        self.models['foundational_course'] = model
        self.scalers['foundational_course'] = scaler
        self.feature_cols['foundational_course'] = feature_cols_encoded
        self.label_encoders['foundational_course_code'] = le_course
        self.label_encoders['foundational_program'] = le_program
        
        return {'accuracy': accuracy}
    
    def prepare_hr_features(self):
        engine = get_dw_engine()
        
        query = """
        SELECT 
            staff_id,
            department_id,
            position,
            years_of_service,
            -- Leave features (if leave table exists)
            COUNT(CASE WHEN leave_type IS NOT NULL THEN 1 END) as total_leave_requests,
            SUM(CASE WHEN leave_status = 'Approved' THEN leave_days ELSE 0 END) as approved_leave_days,
            SUM(CASE WHEN leave_status = 'Pending' THEN leave_days ELSE 0 END) as pending_leave_days,
            -- Payroll features (if payroll table exists)
            AVG(salary) as avg_salary,
            SUM(allowances) as total_allowances,
            COUNT(CASE WHEN payroll_status = 'Processed' THEN 1 END) as processed_payrolls
        FROM dim_staff
        LEFT JOIN fact_leave ON dim_staff.staff_id = fact_leave.staff_id
        LEFT JOIN fact_payroll ON dim_staff.staff_id = fact_payroll.staff_id
        GROUP BY staff_id, department_id, position, years_of_service
        """
        
        try:
            df = pd.read_sql_query(text(query), engine)
        except:
            print("HR tables not found. Creating sample structure...")
            df = pd.DataFrame({
                'staff_id': range(1, 100),
                'department_id': np.random.randint(1, 10, 100),
                'position': np.random.choice(['Lecturer', 'Senior Lecturer', 'Associate Professor', 'Professor'], 100),
                'years_of_service': np.random.randint(1, 20, 100),
                'total_leave_requests': np.random.randint(0, 10, 100),
                'approved_leave_days': np.random.randint(0, 30, 100),
                'pending_leave_days': np.random.randint(0, 15, 100),
                'avg_salary': np.random.uniform(2000000, 10000000, 100),
                'total_allowances': np.random.uniform(500000, 2000000, 100),
                'processed_payrolls': np.random.randint(10, 24, 100)
            })
        
        df = df.fillna(0)
        
        return df
    
    def train_hr_models(self):
        print("Training HR Prediction Models...")
        df = self.prepare_hr_features()
        
        feature_cols = [
            'department_id', 'years_of_service',
            'total_leave_requests', 'approved_leave_days', 'pending_leave_days',
            'avg_salary', 'total_allowances', 'processed_payrolls'
        ]
        
        df['will_stay'] = (
            (df['years_of_service'] > 5) & 
            (df['pending_leave_days'] < 10) &
            (df['avg_salary'] > df['avg_salary'].median())
        ).astype(int)
        
        X = df[feature_cols].fillna(0)
        y = df['will_stay'].fillna(0)
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
        model.fit(X_train_scaled, y_train)
        
        y_pred = model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"Employment Status Prediction Accuracy: {accuracy:.4f}")
        
        self.models['hr_employment_status'] = model
        self.scalers['hr_employment_status'] = scaler
        self.feature_cols['hr_employment_status'] = feature_cols
        
        return {'employment_status_accuracy': accuracy}
    
    def save_all_models(self):
        model_data = {
            'models': self.models,
            'scalers': self.scalers,
            'label_encoders': self.label_encoders,
            'feature_cols': self.feature_cols
        }
        with open(self.model_path / 'enhanced_predictor.pkl', 'wb') as f:
            pickle.dump(model_data, f)
        print("All models saved successfully!")
    
    def load_all_models(self):
        model_file = self.model_path / 'enhanced_predictor.pkl'
        if model_file.exists():
            with open(model_file, 'rb') as f:
                model_data = pickle.load(f)
                self.models = model_data['models']
                self.scalers = model_data['scalers']
                self.label_encoders = model_data.get('label_encoders', {})
                self.feature_cols = model_data['feature_cols']
            print("All models loaded successfully!")
            return True
        else:
            print("Models not found. Train models first.")
            return False
    
    def train_all_models(self):
        print("=" * 60)
        print("TRAINING ALL ENHANCED PREDICTION MODELS")
        print("=" * 60)
        
        results = {}
        
        try:
            results['tuition_attendance'] = self.train_tuition_attendance_model()
            self.save_all_models()
        except Exception as e:
            print(f"Error training tuition-attendance model: {e}")
            import traceback
            traceback.print_exc()
        
        try:
            results['enrollment_trend'] = self.train_enrollment_trend_model()
            self.save_all_models()
        except Exception as e:
            print(f"Error training enrollment trend model: {e}")
            import traceback
            traceback.print_exc()
        
        try:
            results['foundational_course'] = self.train_foundational_course_model()
            self.save_all_models()
        except Exception as e:
            print(f"Error training foundational course model: {e}")
            import traceback
            traceback.print_exc()
        
        try:
            results['hr'] = self.train_hr_models()
            self.save_all_models()
        except Exception as e:
            print(f"Error training HR models: {e}")
            import traceback
            traceback.print_exc()
        
        self.save_all_models()
        
        print("\n" + "=" * 60)
        print("TRAINING COMPLETE")
        print("=" * 60)
        for model_name, metrics in results.items():
            print(f"{model_name}: {metrics}")
        
        return results

if __name__ == "__main__":
    predictor = EnhancedPredictor()
    results = predictor.train_all_models()
