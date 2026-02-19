"""
Enhanced Machine Learning Models for Student Performance Prediction
Includes: Random Forest, Gradient Boosting, and Neural Network
"""
import pandas as pd
import numpy as np
import pickle
from pathlib import Path
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING

class MultiModelPredictor:
    """Multiple ML models for student performance prediction"""
    def __init__(self):
        self.models = {
            'random_forest': None,
            'gradient_boosting': None,
            'neural_network': None
        }
        self.scaler = StandardScaler()
        # Use relative path since we're already in backend folder
        self.model_path = Path(__file__).parent / "models"
        self.model_path.mkdir(parents=True, exist_ok=True)
        self.feature_cols = None
        self.label_encoders = {}  # Store label encoders for categorical variables
    
    def prepare_features(self):
        """Prepare features from data warehouse with enhanced features including high school"""
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Get student demographic data with high school
        student_query = """
        SELECT 
            ds.student_id,
            ds.gender,
            ds.nationality,
            ds.high_school,
            ds.high_school_district,
            YEAR(ds.admission_date) as admission_year,
            YEAR(CURDATE()) - YEAR(ds.admission_date) as years_at_university,
            ds.program_id,
            ds.year_of_study
        FROM dim_student ds
        """
        student_df = pd.read_sql_query(student_query, engine)
        
        # Get attendance data
        attendance_query = """
        SELECT 
            fa.student_id,
            SUM(fa.total_hours) as total_attendance_hours,
            SUM(fa.days_present) as total_days_present,
            COUNT(DISTINCT fa.course_code) as courses_attended,
            AVG(fa.total_hours) as avg_hours_per_course,
            COUNT(*) as total_attendance_records,
            CASE 
                WHEN COUNT(*) > 0 
                THEN (SUM(fa.days_present) / COUNT(*)) * 100
                ELSE 0 
            END as attendance_rate
        FROM fact_attendance fa
        GROUP BY fa.student_id
        """
        attendance_df = pd.read_sql_query(attendance_query, engine)
        
        # Get payment data with tuition completion metrics
        payment_query = """
        SELECT 
            fp.student_id,
            SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) as total_paid,
            SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END) as total_pending,
            SUM(fp.amount) as total_required,
            COUNT(CASE WHEN fp.status = 'Completed' THEN 1 END) as payment_count,
            AVG(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) as avg_payment,
            MAX(CASE WHEN fp.status = 'Completed' THEN fp.date_key ELSE NULL END) as last_payment_date_key,
            CASE 
                WHEN SUM(fp.amount) > 0 
                THEN SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) / SUM(fp.amount) * 100
                ELSE 0 
            END as payment_completion_rate,
            CASE 
                WHEN SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END) > 500000 
                THEN 1 ELSE 0 
            END as has_significant_balance
        FROM fact_payment fp
        GROUP BY fp.student_id
        """
        payment_df = pd.read_sql_query(payment_query, engine)
        
        # Get enrollment data
        enrollment_query = """
        SELECT 
            fe.student_id,
            COUNT(DISTINCT fe.course_code) as total_enrollments,
            COUNT(DISTINCT fe.semester_id) as semesters_enrolled
        FROM fact_enrollment fe
        GROUP BY fe.student_id
        """
        enrollment_df = pd.read_sql_query(enrollment_query, engine)
        
        # Get grade data (target variable) with high school performance metrics
        grade_query = """
        SELECT 
            fg.student_id,
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as avg_grade,
            MIN(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as min_grade,
            MAX(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as max_grade,
            STDDEV(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as grade_stddev,
            COUNT(fg.grade_id) as num_grades,
            COUNT(CASE WHEN fg.exam_status = 'Completed' THEN 1 END) as completed_exams,
            COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) as missed_exams,
            COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END) as failed_exams,
            COUNT(CASE WHEN fg.exam_status = 'FCW' THEN 1 END) as failed_coursework,
            COUNT(CASE WHEN fg.absence_reason LIKE '%%Tuition%%' OR fg.absence_reason LIKE '%%Financial%%' THEN 1 END) as tuition_related_missed,
            COUNT(CASE WHEN fg.absence_reason LIKE '%%Family%%' OR fg.absence_reason LIKE '%%Death%%' OR fg.absence_reason LIKE '%%Bereavement%%' THEN 1 END) as family_related_missed,
            COUNT(CASE WHEN fg.absence_reason LIKE '%%Sickness%%' OR fg.absence_reason LIKE '%%Medical%%' THEN 1 END) as medical_related_missed,
            CASE 
                WHEN COUNT(fg.grade_id) > 0 
                THEN (COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END) / COUNT(fg.grade_id)) * 100
                ELSE 0 
            END as missed_exam_rate,
            AVG(fg.coursework_score) as avg_coursework_score,
            AVG(fg.exam_score) as avg_exam_score
        FROM fact_grade fg
        GROUP BY fg.student_id
        """
        grade_df = pd.read_sql_query(grade_query, engine)
        
        # Get high school performance metrics (aggregate by high school)
        high_school_query = """
        SELECT 
            ds.high_school,
            AVG(CASE WHEN fg.exam_status = 'Completed' THEN fg.grade ELSE NULL END) as school_avg_grade,
            COUNT(DISTINCT ds.student_id) as school_student_count,
            AVG(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) as school_avg_payment,
            SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END) / NULLIF(SUM(fp.amount), 0) * 100 as school_pending_rate
        FROM dim_student ds
        LEFT JOIN fact_grade fg ON ds.student_id = fg.student_id
        LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
        WHERE ds.high_school IS NOT NULL
        GROUP BY ds.high_school
        """
        hs_performance_df = pd.read_sql_query(high_school_query, engine)
        
        # Merge all data
        features_df = student_df.copy()
        features_df = features_df.merge(attendance_df, on='student_id', how='left')
        features_df = features_df.merge(payment_df, on='student_id', how='left')
        features_df = features_df.merge(enrollment_df, on='student_id', how='left')
        features_df = features_df.merge(grade_df, on='student_id', how='left')
        
        # Merge high school performance metrics
        features_df = features_df.merge(
            hs_performance_df[['high_school', 'school_avg_grade', 'school_student_count', 'school_avg_payment', 'school_pending_rate']],
            on='high_school',
            how='left'
        )
        
        # Fill missing values
        numeric_cols = features_df.select_dtypes(include=[np.number]).columns
        features_df[numeric_cols] = features_df[numeric_cols].fillna(0)
        
        # Fill missing MEX/FEX features
        mex_fex_cols = ['missed_exams', 'failed_exams', 'completed_exams', 
                       'tuition_related_missed', 'family_related_missed', 
                       'medical_related_missed', 'missed_exam_rate', 'failed_coursework']
        for col in mex_fex_cols:
            if col not in features_df.columns:
                features_df[col] = 0
            else:
                features_df[col] = features_df[col].fillna(0)
        
        # Fill high school metrics
        hs_cols = ['school_avg_grade', 'school_student_count', 'school_avg_payment', 'school_pending_rate']
        for col in hs_cols:
            if col not in features_df.columns:
                features_df[col] = 0
            else:
                features_df[col] = features_df[col].fillna(0)
        
        engine.dispose()
        return features_df
    
    def train_all_models(self, use_grid_search=False):
        """Train all models"""
        print("Preparing features...")
        features_df = self.prepare_features()
        
        # Prepare target variable
        target = features_df['avg_grade'].fillna(0)
        features_df = features_df.drop(['student_id', 'avg_grade'], axis=1, errors='ignore')
        
        # Encode categorical variables - ensure all strings are converted
        categorical_cols = ['gender', 'nationality', 'high_school', 'high_school_district']
        self.label_encoders = {}
        
        for col in categorical_cols:
            if col in features_df.columns:
                le = LabelEncoder()
                # Convert to string, handle NaN/None values
                features_df[col] = features_df[col].fillna('Unknown').astype(str)
                features_df[col] = le.fit_transform(features_df[col])
                self.label_encoders[col] = le
        
        # Ensure all non-numeric columns are either encoded or dropped
        # Convert any remaining object/string columns that might cause issues
        for col in features_df.columns:
            if features_df[col].dtype == 'object':
                # Try to convert to numeric if possible, otherwise encode
                try:
                    features_df[col] = pd.to_numeric(features_df[col], errors='coerce').fillna(0)
                except:
                    # If conversion fails, use label encoding
                    le = LabelEncoder()
                    features_df[col] = le.fit_transform(features_df[col].astype(str).fillna('Unknown'))
                    self.label_encoders[col] = le
        
        # Select numeric features
        self.feature_cols = features_df.select_dtypes(include=[np.number]).columns.tolist()
        X = features_df[self.feature_cols].fillna(0)
        y = target.fillna(0)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        results = {}
        
        # Train Random Forest
        print("\nTraining Random Forest...")
        rf = RandomForestRegressor(n_estimators=100, max_depth=15, random_state=42, n_jobs=-1)
        if use_grid_search:
            param_grid = {
                'n_estimators': [50, 100, 200],
                'max_depth': [10, 15, 20],
                'min_samples_split': [2, 5]
            }
            rf = GridSearchCV(rf, param_grid, cv=5, scoring='r2', n_jobs=-1)
        rf.fit(X_train_scaled, y_train)
        if use_grid_search:
            rf = rf.best_estimator_
        self.models['random_forest'] = rf
        rf_pred = rf.predict(X_test_scaled)
        results['random_forest'] = {
            'r2': r2_score(y_test, rf_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, rf_pred)),
            'mae': mean_absolute_error(y_test, rf_pred)
        }
        print(f"Random Forest - R²: {results['random_forest']['r2']:.4f}, RMSE: {results['random_forest']['rmse']:.2f}")
        
        # Train Gradient Boosting
        print("\nTraining Gradient Boosting...")
        gb = GradientBoostingRegressor(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
        if use_grid_search:
            param_grid = {
                'n_estimators': [50, 100, 200],
                'max_depth': [3, 5, 7],
                'learning_rate': [0.05, 0.1, 0.2]
            }
            gb = GridSearchCV(gb, param_grid, cv=5, scoring='r2', n_jobs=-1)
        gb.fit(X_train_scaled, y_train)
        if use_grid_search:
            gb = gb.best_estimator_
        self.models['gradient_boosting'] = gb
        gb_pred = gb.predict(X_test_scaled)
        results['gradient_boosting'] = {
            'r2': r2_score(y_test, gb_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, gb_pred)),
            'mae': mean_absolute_error(y_test, gb_pred)
        }
        print(f"Gradient Boosting - R²: {results['gradient_boosting']['r2']:.4f}, RMSE: {results['gradient_boosting']['rmse']:.2f}")
        
        # Train Neural Network
        print("\nTraining Neural Network...")
        nn = MLPRegressor(hidden_layer_sizes=(100, 50), max_iter=500, random_state=42, early_stopping=True)
        nn.fit(X_train_scaled, y_train)
        self.models['neural_network'] = nn
        nn_pred = nn.predict(X_test_scaled)
        results['neural_network'] = {
            'r2': r2_score(y_test, nn_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, nn_pred)),
            'mae': mean_absolute_error(y_test, nn_pred)
        }
        print(f"Neural Network - R²: {results['neural_network']['r2']:.4f}, RMSE: {results['neural_network']['rmse']:.2f}")
        
        # Save models
        self.save_models()
        
        return results
    
    def predict(self, student_id, model_type='ensemble'):
        """Predict student performance using specified model or ensemble"""
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Get student features
        query = text("""
        SELECT 
            ds.student_id,
            ds.gender,
            ds.nationality,
            ds.high_school,
            ds.high_school_district,
            YEAR(ds.admission_date) as admission_year,
            YEAR(CURDATE()) - YEAR(ds.admission_date) as years_at_university,
            ds.program_id,
            ds.year_of_study,
            COALESCE(SUM(fa.total_hours), 0) as total_attendance_hours,
            COALESCE(SUM(fa.days_present), 0) as total_days_present,
            COALESCE(COUNT(DISTINCT fa.course_code), 0) as courses_attended,
            COALESCE(AVG(fa.total_hours), 0) as avg_hours_per_course,
            COALESCE(COUNT(*), 0) as total_attendance_records,
            CASE 
                WHEN COUNT(*) > 0 
                THEN (SUM(fa.days_present) / COUNT(*)) * 100
                ELSE 0 
            END as attendance_rate,
            COALESCE(SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END), 0) as total_pending,
            COALESCE(SUM(fp.amount), 0) as total_required,
            COALESCE(COUNT(CASE WHEN fp.status = 'Completed' THEN 1 END), 0) as payment_count,
            COALESCE(AVG(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END), 0) as avg_payment,
            CASE 
                WHEN SUM(fp.amount) > 0 
                THEN SUM(CASE WHEN fp.status = 'Completed' THEN fp.amount ELSE 0 END) / SUM(fp.amount) * 100
                ELSE 0 
            END as payment_completion_rate,
            CASE 
                WHEN SUM(CASE WHEN fp.status = 'Pending' THEN fp.amount ELSE 0 END) > 500000 
                THEN 1 ELSE 0 
            END as has_significant_balance,
            COALESCE(COUNT(DISTINCT fe.course_code), 0) as total_enrollments,
            COALESCE(COUNT(DISTINCT fe.semester_id), 0) as semesters_enrolled,
            COALESCE(AVG(dc.credits), 0) as avg_course_credits,
            COALESCE(SUM(dc.credits), 0) as total_credits,
            COALESCE(COUNT(CASE WHEN fg.exam_status = 'MEX' THEN 1 END), 0) as missed_exams,
            COALESCE(COUNT(CASE WHEN fg.exam_status = 'FEX' THEN 1 END), 0) as failed_exams,
            COALESCE(COUNT(CASE WHEN fg.exam_status = 'FCW' THEN 1 END), 0) as failed_coursework,
            COALESCE(AVG(fg.coursework_score), 0) as avg_coursework_score,
            COALESCE(AVG(fg.exam_score), 0) as avg_exam_score
        FROM dim_student ds
        LEFT JOIN fact_attendance fa ON ds.student_id = fa.student_id
        LEFT JOIN fact_payment fp ON ds.student_id = fp.student_id
        LEFT JOIN fact_enrollment fe ON ds.student_id = fe.student_id
        LEFT JOIN dim_course dc ON fe.course_code = dc.course_code
        LEFT JOIN fact_grade fg ON ds.student_id = fg.student_id
        WHERE ds.student_id = :student_id
        GROUP BY ds.student_id, ds.gender, ds.nationality, ds.high_school, ds.high_school_district, ds.admission_date, ds.program_id, ds.year_of_study
        """)
        
        student_data = pd.read_sql_query(query, engine, params={'student_id': student_id})
        engine.dispose()
        
        if student_data.empty:
            raise ValueError(f"Student {student_id} not found")
        
        # Encode categorical variables - MUST match training encoding
        # Use the same label encoders from training, or encode in place like training does
        categorical_cols = ['gender', 'nationality', 'high_school', 'high_school_district']
        
        for col in categorical_cols:
            if col in student_data.columns:
                if col in self.label_encoders:
                    # Use saved label encoder from training
                    le = self.label_encoders[col]
                    # Convert to string, handle NaN/None values (same as training)
                    student_data[col] = student_data[col].fillna('Unknown').astype(str)
                    # Handle unseen values - use 'Unknown' for values not in training
                    try:
                        student_data[col] = le.transform(student_data[col])
                    except ValueError:
                        # If value not seen during training, map to 'Unknown' first
                        student_data[col] = student_data[col].replace(
                            [v for v in student_data[col].unique() if v not in le.classes_],
                            'Unknown'
                        )
                        student_data[col] = le.transform(student_data[col])
                else:
                    # Fallback: encode using same method as training
                    # Convert to string, handle NaN/None values
                    student_data[col] = student_data[col].fillna('Unknown').astype(str)
                    # For gender, use simple mapping
                    if col == 'gender':
                        student_data[col] = student_data[col].map({'M': 1, 'F': 0, 'Male': 1, 'Female': 0}).fillna(0)
                    else:
                        # Use categorical codes as fallback
                        student_data[col] = pd.Categorical(student_data[col]).codes
        
        # Prepare feature vector
        if not self.feature_cols:
            raise ValueError("Model not trained. Please train models first.")
        
        # Check for missing columns and add them with default values
        missing_cols = set(self.feature_cols) - set(student_data.columns)
        if missing_cols:
            print(f"Warning: Missing columns in prediction data: {missing_cols}")
            for col in missing_cols:
                student_data[col] = 0  # Add missing columns with default value 0
        
        # Use all feature_cols to match training (in correct order)
        X_df = student_data[self.feature_cols].copy()
        
        # Ensure all columns are numeric before converting to array
        # This is a safety check - encoding above should have made them numeric, but double-check
        for col in X_df.columns:
            # First replace common non-numeric strings (case-insensitive) - safety check
            if X_df[col].dtype == 'object' or X_df[col].dtype == 'string':
                # Replace any string values that look like 'M', 'N/A', etc.
                X_df[col] = X_df[col].astype(str).replace(['M', 'm', 'N/A', 'n/a', 'NULL', 'null', 'NONE', 'none', '', 'nan', 'NaN', 'None'], '0')
            # Then convert to numeric - this will handle any remaining non-numeric values
            X_df[col] = pd.to_numeric(X_df[col], errors='coerce').fillna(0)
        # Ensure final array is float64 - this will raise an error if there are still non-numeric values
        try:
            X = X_df.values.astype(np.float64)
        except (ValueError, TypeError) as e:
            # If conversion fails, log the problematic columns and force conversion
            print(f"Warning: Error converting to float64: {e}")
            print(f"Problematic columns and their dtypes: {X_df.dtypes}")
            print(f"Sample values:\n{X_df.head()}")
            # Force all columns to be numeric one more time
            for col in X_df.columns:
                X_df[col] = pd.to_numeric(X_df[col], errors='coerce').fillna(0)
            X = X_df.values.astype(np.float64)
        
        if not hasattr(self.scaler, 'mean_'):
            raise ValueError("Model scaler not fitted. Please train models first.")
        
        try:
            X_scaled = self.scaler.transform(X)
        except (ValueError, TypeError) as e:
            # If transform fails, check for any remaining non-numeric values
            error_msg = str(e)
            print(f"Error transforming features: {error_msg}")
            print(f"Feature columns: {available_cols}")
            print(f"X shape: {X.shape}, X dtype: {X.dtype}")
            print(f"X_df dtypes:\n{X_df.dtypes}")
            print(f"X_df sample:\n{X_df.head()}")
            # Check if X is still object type (contains strings)
            if X.dtype == 'object':
                print("WARNING: X array is object type - contains non-numeric values!")
                # Force all values to be numeric one more time, more aggressively
                for col in X_df.columns:
                    # Convert to string first, replace all non-numeric patterns
                    col_series = X_df[col].astype(str)
                    # Replace any single character 'M' or other problematic values
                    col_series = col_series.replace(['M', 'm', 'N/A', 'n/a', 'NULL', 'null', 'NONE', 'none', '', 'nan', 'NaN', 'None'], '0')
                    X_df[col] = pd.to_numeric(col_series, errors='coerce').fillna(0)
                X = X_df.values.astype(np.float64)
            else:
                # Just retry with the same X
                pass
            # Try transform again
            try:
                X_scaled = self.scaler.transform(X)
            except Exception as e2:
                print(f"Second transform attempt also failed: {e2}")
                raise ValueError(f"Unable to transform features. Error: {error_msg}. Retry error: {e2}")
        
        # Make predictions
        if model_type == 'ensemble':
            # Average predictions from all models
            predictions = []
            for model_name, model in self.models.items():
                if model is not None:
                    pred = model.predict(X_scaled)[0]
                    predictions.append(pred)
            prediction = np.mean(predictions) if predictions else 0
        elif model_type in self.models and self.models[model_type] is not None:
            prediction = self.models[model_type].predict(X_scaled)[0]
        else:
            raise ValueError(f"Model {model_type} not available")
        
        return max(0, min(100, prediction))  # Clamp between 0 and 100
    
    def predict_scenario(self, scenario_params):
        """Predict performance for a hypothetical scenario"""
        # Create feature vector from scenario parameters
        # This allows "what-if" analysis
        pass
    
    def save_models(self):
        """Save all models"""
        model_data = {
            'models': self.models,
            'scaler': self.scaler,
            'feature_cols': self.feature_cols,
            'label_encoders': self.label_encoders
        }
        with open(self.model_path / 'multi_model_predictor.pkl', 'wb') as f:
            pickle.dump(model_data, f)
    
    def load_models(self):
        """Load saved models"""
        model_file = self.model_path / 'multi_model_predictor.pkl'
        if model_file.exists():
            with open(model_file, 'rb') as f:
                model_data = pickle.load(f)
                self.models = model_data['models']
                self.scaler = model_data['scaler']
                self.feature_cols = model_data['feature_cols']
                self.label_encoders = model_data.get('label_encoders', {})  # Load label encoders if available
        else:
            print("Models not found. Training new models...")
            self.train_all_models()

if __name__ == "__main__":
    predictor = MultiModelPredictor()
    results = predictor.train_all_models(use_grid_search=False)
    print("\n=== Model Performance Summary ===")
    for model_name, metrics in results.items():
        print(f"{model_name}: R²={metrics['r2']:.4f}, RMSE={metrics['rmse']:.2f}, MAE={metrics['mae']:.2f}")


