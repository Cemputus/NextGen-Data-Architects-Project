"""
Sample script: load the saved CGPA model and run predictions on a few rows.

Run from the Other_Analysis folder (where outputs/ lives):
    python sample_predict_cgpa.py

Requires: outputs/cgpa_model.joblib and outputs/modeling_table_student_semester.csv
"""

from pathlib import Path
import numpy as np
import pandas as pd
import joblib

BASE = Path(__file__).resolve().parent
OUT_DIR = BASE / "outputs"

def main():
    # Load saved pipeline and feature list
    path = OUT_DIR / "cgpa_model.joblib"
    if not path.exists():
        print(f"Not found: {path}. Run 03_cgpa_prediction_model.ipynb and save the model first.")
        return
    artifact = joblib.load(path)
    pipe = artifact["pipeline"]
    features = artifact["features"]

    # Load modeling table and take 5 rows as sample
    table_path = OUT_DIR / "modeling_table_student_semester.csv"
    if not table_path.exists():
        print(f"Not found: {table_path}. Run 02_integration_feature_engineering.ipynb first.")
        return
    df = pd.read_csv(table_path).dropna(subset=["CGPA"]).head(5)
    X_sample = df[features].copy()
    y_actual = df["CGPA"].astype(float).values

    # Predict
    y_pred = pipe.predict(X_sample)

    # Show results
    print("Sample prediction: 5 rows from the modeling table\n")
    result = df[["REG_NO", "SEMESTER_INDEX"]].copy()
    result["CGPA_actual"] = y_actual
    result["CGPA_predicted"] = np.round(y_pred, 3)
    result["error"] = np.round(y_pred - y_actual, 3)
    print(result.to_string(index=False))
    print(f"\nMAE (this sample): {np.abs(y_pred - y_actual).mean():.4f}")

if __name__ == "__main__":
    main()
