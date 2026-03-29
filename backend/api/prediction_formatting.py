"""
Shared prediction post-processing: calibration, GPA (0–5), and student profile enrichment.
"""
from __future__ import annotations

import math
from typing import Any, Dict, Optional

import pandas as pd
from sqlalchemy import create_engine, text

from config import DATA_WAREHOUSE_CONN_STRING


def resolve_student_identifier(identifier: Optional[str]) -> Optional[str]:
    """
    Resolve access number, registration number, or student_id to dim_student.student_id.
    Returns None if no matching row exists.
    """
    if identifier is None:
        return None
    s = str(identifier).strip()
    if not s:
        return None
    engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
    try:
        q = text(
            """
            SELECT student_id::text AS student_id
            FROM dim_student
            WHERE student_id::text = :id
               OR TRIM(COALESCE(access_number::text, '')) = TRIM(:id)
               OR TRIM(COALESCE(reg_no::text, '')) = TRIM(:id)
            LIMIT 1
            """
        )
        df = pd.read_sql_query(q, engine, params={"id": s})
        if not df.empty:
            return str(df.iloc[0]["student_id"])
    except Exception:
        pass
    finally:
        try:
            engine.dispose()
        except Exception:
            pass
    return None


def calibrate_percent(raw: float) -> float:
    """
    Map raw model output (0–100) to a display percentage.
    Raw scores in [96, 100] are compressed linearly into [94.1, 95.4] to avoid over-confident tops.
    """
    try:
        x = float(raw)
    except (TypeError, ValueError):
        return 0.0
    if x != x or math.isnan(x):  # NaN
        return 0.0
    x = max(0.0, min(100.0, x))
    if x < 96.0:
        return round(x, 2)
    lo_out, hi_out = 94.1, 95.4
    t = (x - 96.0) / (100.0 - 96.0)
    return round(lo_out + t * (hi_out - lo_out), 2)


def percent_to_gpa(percent: float, scale_max: float = 5.0) -> float:
    """
    Convert percentage (0–100) to GPA on a fixed scale (default highest grade = 5.0).
    Uses calibrated percentage after clamping to [0, 100].
    """
    try:
        p = float(percent)
    except (TypeError, ValueError):
        return 0.0
    if p != p or math.isnan(p):
        return 0.0
    p = max(0.0, min(100.0, p))
    return round((p / 100.0) * scale_max, 2)


def letter_grade_from_percent(score: float) -> str:
    """Letter grade from numeric percentage (uses calibrated range)."""
    try:
        s = float(score)
    except (TypeError, ValueError):
        return 'F'
    if s != s or math.isnan(s):
        return 'F'
    if s >= 80:
        return 'A'
    if s >= 75:
        return 'B+'
    if s >= 70:
        return 'B'
    if s >= 60:
        return 'C'
    if s >= 50:
        return 'D'
    return 'F'


def fetch_student_profile(student_id: str) -> Dict[str, Any]:
    """
    Load display fields from the warehouse for a resolved dim_student.student_id.
    Returns nulls when joins are missing (orphan program, etc.).
    """
    out: Dict[str, Any] = {
        'student_name': None,
        'first_name': None,
        'last_name': None,
        'access_number': None,
        'reg_number': None,
        'faculty_id': None,
        'faculty_name': None,
        'department_id': None,
        'department_name': None,
        'program_id': None,
        'program_name': None,
    }
    if not student_id or not str(student_id).strip():
        return out

    engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
    try:
        q = text(
            """
            SELECT
                ds.student_id::text AS student_id,
                TRIM(CONCAT(COALESCE(ds.first_name::text, ''), ' ', COALESCE(ds.last_name::text, ''))) AS student_name,
                ds.first_name::text AS first_name,
                ds.last_name::text AS last_name,
                ds.access_number::text AS access_number,
                ds.reg_no::text AS reg_number,
                df.faculty_id AS faculty_id,
                df.faculty_name::text AS faculty_name,
                ddept.department_id AS department_id,
                ddept.department_name::text AS department_name,
                dp.program_id AS program_id,
                dp.program_name::text AS program_name
            FROM dim_student ds
            LEFT JOIN dim_program dp ON ds.program_id = dp.program_id
            LEFT JOIN dim_department ddept ON dp.department_id = ddept.department_id
            LEFT JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
            WHERE ds.student_id = :sid
            LIMIT 1
            """
        )
        df = pd.read_sql_query(q, engine, params={'sid': str(student_id).strip()})
        if df.empty:
            return out
        row = df.iloc[0]
        for k in list(out.keys()):
            v = row.get(k)
            if v is not None and not (isinstance(v, float) and pd.isna(v)):
                out[k] = v
        # Normalize empty name
        sn = out.get('student_name')
        if isinstance(sn, str) and not sn.strip():
            out['student_name'] = None
    except Exception:
        pass
    finally:
        try:
            engine.dispose()
        except Exception:
            pass
    return out


def build_prediction_payload(
    *,
    student_id_resolved: str,
    raw_percent: float,
    model_type: str,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Standard API shape: calibrated %, GPA (max 5), letter, raw for transparency, student profile.
    """
    try:
        raw = float(raw_percent)
    except (TypeError, ValueError):
        raw = 0.0
    calibrated = calibrate_percent(raw)
    gpa = percent_to_gpa(calibrated)
    letter = letter_grade_from_percent(calibrated)
    profile = fetch_student_profile(student_id_resolved)

    payload: Dict[str, Any] = {
        'student_id': student_id_resolved,
        'model_type': model_type,
        'predicted_grade': round(calibrated, 2),
        'predicted_grade_raw': round(raw, 2),
        'predicted_letter_grade': letter,
        'gpa': gpa,
        'gpa_scale_max': 5.0,
        'calibration_applied': raw >= 96.0,
        'calibration_note': (
            'Raw scores between 96% and 100% are reported as 94.1%–95.4% for consistency.'
            if raw >= 96.0
            else None
        ),
    }
    payload['student'] = profile
    # Flatten common fields for clients that do not read nested `student`
    payload['student_name'] = profile.get('student_name')
    payload['access_number'] = profile.get('access_number')
    payload['reg_number'] = profile.get('reg_number')
    payload['faculty_name'] = profile.get('faculty_name')
    payload['department_name'] = profile.get('department_name')
    payload['program_name'] = profile.get('program_name')
    if extra:
        for k, v in extra.items():
            if v is not None:
                payload[k] = v
    return payload


def enrich_model_prediction_block(raw_percent: float) -> Dict[str, Any]:
    """For nested scenario / multi-model outputs."""
    try:
        raw = float(raw_percent)
    except (TypeError, ValueError):
        raw = 0.0
    calibrated = calibrate_percent(raw)
    return {
        'predicted_grade': round(calibrated, 2),
        'predicted_grade_raw': round(raw, 2),
        'predicted_letter_grade': letter_grade_from_percent(calibrated),
        'gpa': percent_to_gpa(calibrated),
        'gpa_scale_max': 5.0,
        'calibration_applied': raw >= 96.0,
        'calibration_note': (
            'Raw scores between 96% and 100% are reported as 94.1%–95.4% for consistency.'
            if raw >= 96.0
            else None
        ),
    }
