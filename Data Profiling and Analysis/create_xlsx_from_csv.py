"""
Generate the .xlsx files expected by the project documentation from existing CSV data.

Documentation (nextgen_analytics_master_technical_documentation.md) expects:
- students_list15.xlsx, students_list16.xlsx
- student_grades_summary_list15.xlsx, student_grades_summary_list16.xlsx (sheets: SEMESTER_GPA, STUDENT_CGPA)
- academic_progression_list15.xlsx, academic_progression_list16.xlsx
- course_catalog_ucu.xlsx
- dim_date_2022_2026.xlsx

This script derives these from the available CSVs so the project has a complete asset set.
Run from the Other_Analysis directory: python create_xlsx_from_csv.py
"""

from __future__ import annotations

from pathlib import Path
import pandas as pd

try:
    import openpyxl  # noqa: F401
except ImportError:
    raise SystemExit("Please install openpyxl: pip install openpyxl")

BASE_DIR = Path(__file__).resolve().parent
OUT_DIR = BASE_DIR


def main() -> None:
    # ---- Students (from transcript: one row per student) ----
    for list_name, csv_name in [
        ("list15", "student_transcript_list15.csv"),
        ("list16", "student_transcript_list16.csv"),
    ]:
        path = BASE_DIR / csv_name
        if not path.exists():
            continue
        trans = pd.read_csv(path)
        students = (
            trans.groupby("REG_NO", as_index=False)
            .agg(
                ACC_NO=("ACC_NO", "first"),
                PROGRAM=("PROGRAM", "first"),
                TOTAL_REGISTRATIONS=("SEMESTER_INDEX", "count"),
            )
            .rename(columns={"TOTAL_REGISTRATIONS": "TOTAL_REGISTRATIONS"})
        )
        out = OUT_DIR / f"students_{list_name}.xlsx"
        students.to_excel(out, index=False, engine="openpyxl")
        print(f"Written {out}")

    # ---- Student grades summary (two sheets: SEMESTER_GPA, STUDENT_CGPA) ----
    for list_name, csv_name in [
        ("list15", "student_transcript_list15.csv"),
        ("list16", "student_transcript_list16.csv"),
    ]:
        path = BASE_DIR / csv_name
        if not path.exists():
            continue
        trans = pd.read_csv(path)
        semester_gpa = trans[
            [
                "REG_NO", "ACC_NO", "PROGRAM", "ACADEMIC_YEAR", "SEMESTER", "SEMESTER_INDEX",
                "CREDITS_ATTEMPTED", "QUALITY_POINTS", "COURSES_COUNT", "PASSED_COURSES", "FAILED_COURSES",
                "SEMESTER_GPA", "CUM_CREDITS_ATTEMPTED", "CUM_CREDITS_PASSED", "CUM_QUALITY_POINTS", "CGPA",
            ]
        ].copy()
        student_cgpa = (
            trans.sort_values(["REG_NO", "SEMESTER_INDEX"])
            .groupby("REG_NO", as_index=False)
            .last()[["REG_NO", "ACC_NO", "PROGRAM", "CGPA", "CUM_CREDITS_ATTEMPTED", "CUM_CREDITS_PASSED"]]
            .rename(columns={"CGPA": "FINAL_CGPA"})
        )
        out = OUT_DIR / f"student_grades_summary_{list_name}.xlsx"
        with pd.ExcelWriter(out, engine="openpyxl") as writer:
            semester_gpa.to_excel(writer, sheet_name="SEMESTER_GPA", index=False)
            student_cgpa.to_excel(writer, sheet_name="STUDENT_CGPA", index=False)
        print(f"Written {out} (sheets: SEMESTER_GPA, STUDENT_CGPA)")

    # ---- Academic progression (from grades: one row per student x course x semester = attempt) ----
    for list_name, csv_name in [
        ("list15", "student_grades_list15.csv"),
        ("list16", "student_grades_list16.csv"),
    ]:
        path = BASE_DIR / csv_name
        if not path.exists():
            continue
        grades = pd.read_csv(path)
        grades = grades.sort_values(["REG_NO", "COURSE_CODE", "SEMESTER_INDEX"])
        grades["_attempt_rank"] = grades.groupby(["REG_NO", "COURSE_CODE"]).cumcount() + 1
        grades["PROGRESSION_ID"] = range(1, len(grades) + 1)
        grades["ATTEMPT_NUMBER"] = grades["_attempt_rank"]
        grades["RETAKE_FLAG"] = (grades["_attempt_rank"] > 1).astype(int)
        grades["PROGRESSION_STATUS"] = grades["STATUS"].fillna("").astype(str)
        want = [
            "PROGRESSION_ID", "REG_NO", "ACC_NO", "PROGRAM", "ACADEMIC_YEAR", "SEMESTER", "SEMESTER_INDEX",
            "COURSE_CODE", "COURSE_TITLE", "COURSE_UNITS",
            "ATTEMPT_NUMBER", "RETAKE_FLAG", "PROGRESSION_STATUS",
            "FINAL_MARK_100", "LETTER_GRADE", "GRADE_POINTS",
        ]
        progression = grades[[c for c in want if c in grades.columns]].copy()
        out = OUT_DIR / f"academic_progression_{list_name}.xlsx"
        progression.to_excel(out, index=False, engine="openpyxl")
        print(f"Written {out}")

    # ---- Course catalog (unique courses from grades) ----
    catalog_dfs = []
    for csv_name in ["student_grades_list15.csv", "student_grades_list16.csv"]:
        path = BASE_DIR / csv_name
        if path.exists():
            g = pd.read_csv(path)
            cols = [c for c in ["PROGRAM", "SEMESTER_INDEX", "COURSE_CODE", "COURSE_TITLE", "COURSE_UNITS"] if c in g.columns]
            if cols:
                catalog_dfs.append(g[cols].drop_duplicates())
    if catalog_dfs:
        catalog = pd.concat(catalog_dfs, ignore_index=True).drop_duplicates(
            subset=["PROGRAM", "SEMESTER_INDEX", "COURSE_CODE"], keep="first"
        )
        catalog["COURSE_TYPE"] = "Core"  # placeholder
        out = OUT_DIR / "course_catalog_ucu.xlsx"
        catalog.to_excel(out, index=False, engine="openpyxl")
        print(f"Written {out}")

    # ---- Date dimension 2022-2026 ----
    dates = pd.date_range("2022-01-01", "2026-12-31", freq="D")
    dim_date = pd.DataFrame({
        "date_key": [d.strftime("%Y%m%d") for d in dates],
        "date": dates,
        "year": dates.year,
        "month": dates.month,
        "day": dates.day,
        "quarter": dates.quarter,
        "day_of_week": dates.dayofweek + 1,
        "day_name": [d.strftime("%A") for d in dates],
        "month_name": [d.strftime("%B") for d in dates],
    })
    dim_date["date"] = dim_date["date"].dt.strftime("%Y-%m-%d")
    out = OUT_DIR / "dim_date_2022_2026.xlsx"
    dim_date.to_excel(out, index=False, engine="openpyxl")
    print(f"Written {out}")

    print("Done. All .xlsx files created from existing CSV data.")


if __name__ == "__main__":
    main()
