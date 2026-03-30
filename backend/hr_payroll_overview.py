from __future__ import annotations

from datetime import date

import pandas as pd
from sqlalchemy import text

from config import DB2_NAME

LIST_LIMIT = 300

_ROLE_CASE_SQL = f"""
    CASE
        WHEN p."PositionTitle" LIKE '%Senate%' THEN 'Senate'
        WHEN p."PositionTitle" LIKE '%Dean%' THEN 'Dean'
        WHEN p."PositionTitle" LIKE '%Head of Department%' OR p."PositionTitle" LIKE '%HOD%' THEN 'HOD'
        WHEN p."PositionTitle" LIKE '%Assistant Lecturer%' THEN 'Assistant Lecturer'
        WHEN p."PositionTitle" LIKE '%Lecturer%' AND p."PositionTitle" NOT LIKE '%Assistant%' THEN 'Lecturer'
        WHEN p."PositionTitle" LIKE '%Finance%' OR p."PositionTitle" LIKE '%Accountant%' THEN 'Finance'
        WHEN p."PositionTitle" LIKE '%Human Resource%' OR p."PositionTitle" LIKE 'HR %'
             OR p."PositionTitle" LIKE '% HR%' THEN 'HR'
        ELSE 'Other Staff'
    END
"""

def _empty_payload() -> dict:
    return {
        'payroll_by_role': [],
        'total_payroll': 0.0,
        'paid': [],
        'pending': [],
        'latest_pay_period': None,
        'paid_count': 0,
        'pending_count': 0,
        'paid_list_truncated': False,
        'pending_list_truncated': False,
        'data_source': 'none',
    }

def _row_to_paid(r) -> dict:
    return {
        'employee_id': int(r['employee_id']) if pd.notna(r.get('employee_id')) else None,
        'name': str(r.get('full_name') or ''),
        'full_name': str(r.get('full_name') or ''),
        'username': '',
        'net_pay': float(r.get('net_pay') or 0),
        'pay_period': str(r.get('pay_period') or ''),
        'role_category': str(r.get('role_category') or ''),
    }

def _row_to_pending(r) -> dict:
    return {
        'employee_id': int(r['employee_id']) if pd.notna(r.get('employee_id')) else None,
        'name': str(r.get('full_name') or ''),
        'full_name': str(r.get('full_name') or ''),
        'username': '',
        'role_category': str(r.get('role_category') or ''),
    }

def _from_mirror_payroll(engine) -> dict | None:
    try:
        chk = pd.read_sql_query(
            text(f'SELECT COUNT(*) AS c FROM {DB2_NAME}.payroll'),
            engine,
        )
        if chk.empty or int(chk.iloc[0]['c'] or 0) == 0:
            return None
    except Exception:
        return None

    latest_df = pd.read_sql_query(
        text(f'SELECT MAX("PayPeriod") AS latest_pp FROM {DB2_NAME}.payroll'),
        engine,
    )
    latest_pp = None
    if not latest_df.empty:
        raw = latest_df.iloc[0].get('latest_pp')
        if raw is not None and not (isinstance(raw, float) and pd.isna(raw)):
            latest_pp = str(raw)

    if not latest_pp:
        return None

    role_sql = f"""
    WITH latest AS (SELECT CAST(:pp AS VARCHAR) AS pp),
    pr_scope AS (
        SELECT pr."EmployeeID", SUM(COALESCE(pr."NetPay", 0)) AS net_pay
        FROM {DB2_NAME}.payroll pr, latest l
        WHERE pr."PayPeriod" = l.pp
        GROUP BY pr."EmployeeID"
        HAVING SUM(COALESCE(pr."NetPay", 0)) > 0
    )
    SELECT
        {_ROLE_CASE_SQL} AS role_category,
        COUNT(DISTINCT e."EmployeeID") AS employee_count,
        SUM(s.net_pay) AS total_net_pay
    FROM pr_scope s
    JOIN {DB2_NAME}.employees e ON s."EmployeeID" = e."EmployeeID"
    JOIN {DB2_NAME}.positions p ON e."PositionID" = p."PositionID"
    GROUP BY 1
    ORDER BY total_net_pay DESC NULLS LAST
    """
    by_role_df = pd.read_sql_query(text(role_sql), engine, params={'pp': latest_pp})
    payroll_by_role = []
    for _, row in by_role_df.iterrows():
        payroll_by_role.append({
            'role_name': str(row.get('role_category') or ''),
            'role_category': str(row.get('role_category') or ''),
            'employee_count': int(row.get('employee_count') or 0),
            'total_net_pay': round(float(row.get('total_net_pay') or 0), 2),
        })

    paid_sql = f"""
    WITH latest AS (SELECT CAST(:pp AS VARCHAR) AS pp),
    pr_scope AS (
        SELECT pr."EmployeeID", SUM(COALESCE(pr."NetPay", 0)) AS net_pay
        FROM {DB2_NAME}.payroll pr, latest l
        WHERE pr."PayPeriod" = l.pp
        GROUP BY pr."EmployeeID"
        HAVING SUM(COALESCE(pr."NetPay", 0)) > 0
    )
    SELECT
        e."EmployeeID" AS employee_id,
        e."FullName" AS full_name,
        s.net_pay,
        (SELECT pp FROM latest LIMIT 1) AS pay_period,
        {_ROLE_CASE_SQL} AS role_category
    FROM pr_scope s
    JOIN {DB2_NAME}.employees e ON s."EmployeeID" = e."EmployeeID"
    JOIN {DB2_NAME}.positions p ON e."PositionID" = p."PositionID"
    ORDER BY e."FullName"
    LIMIT :lim
    """
    paid_df = pd.read_sql_query(text(paid_sql), engine, params={'pp': latest_pp, 'lim': LIST_LIMIT})

    cnt_paid_sql = f"""
    WITH latest AS (SELECT CAST(:pp AS VARCHAR) AS pp),
    pr_scope AS (
        SELECT pr."EmployeeID"
        FROM {DB2_NAME}.payroll pr, latest l
        WHERE pr."PayPeriod" = l.pp
        GROUP BY pr."EmployeeID"
        HAVING SUM(COALESCE(pr."NetPay", 0)) > 0
    )
    SELECT COUNT(*) AS c FROM pr_scope
    """
    cnt_pending_sql = f"""
    WITH latest AS (SELECT CAST(:pp AS VARCHAR) AS pp)
    SELECT COUNT(*) AS c
    FROM {DB2_NAME}.employees e
    WHERE NOT EXISTS (
        SELECT 1
        FROM {DB2_NAME}.payroll pr, latest l
        WHERE pr."EmployeeID" = e."EmployeeID"
          AND pr."PayPeriod" = l.pp
          AND COALESCE(pr."NetPay", 0) > 0
    )
    """
    paid_total = int(
        pd.read_sql_query(text(cnt_paid_sql), engine, params={'pp': latest_pp}).iloc[0]['c'] or 0
    )
    pending_total = int(
        pd.read_sql_query(text(cnt_pending_sql), engine, params={'pp': latest_pp}).iloc[0]['c'] or 0
    )

    pending_sql = f"""
    WITH latest AS (SELECT CAST(:pp AS VARCHAR) AS pp)
    SELECT
        e."EmployeeID" AS employee_id,
        e."FullName" AS full_name,
        {_ROLE_CASE_SQL} AS role_category
    FROM {DB2_NAME}.employees e
    JOIN {DB2_NAME}.positions p ON e."PositionID" = p."PositionID"
    WHERE NOT EXISTS (
        SELECT 1
        FROM {DB2_NAME}.payroll pr, latest l
        WHERE pr."EmployeeID" = e."EmployeeID"
          AND pr."PayPeriod" = l.pp
          AND COALESCE(pr."NetPay", 0) > 0
    )
    ORDER BY e."FullName"
    LIMIT :lim
    """
    pending_df = pd.read_sql_query(text(pending_sql), engine, params={'pp': latest_pp, 'lim': LIST_LIMIT})

    total_sql = f"""
    WITH latest AS (SELECT CAST(:pp AS VARCHAR) AS pp)
    SELECT COALESCE(SUM(pr."NetPay"), 0) AS total_net
    FROM {DB2_NAME}.payroll pr, latest l
    WHERE pr."PayPeriod" = l.pp
    """
    total_df = pd.read_sql_query(text(total_sql), engine, params={'pp': latest_pp})
    total_payroll = float(total_df.iloc[0]['total_net'] or 0) if not total_df.empty else 0.0

    paid = [_row_to_paid(r) for _, r in paid_df.iterrows()]
    pending = [_row_to_pending(r) for _, r in pending_df.iterrows()]

    return {
        'payroll_by_role': payroll_by_role,
        'total_payroll': round(total_payroll, 2),
        'paid': paid,
        'pending': pending,
        'latest_pay_period': latest_pp,
        'paid_count': paid_total,
        'pending_count': pending_total,
        'paid_list_truncated': paid_total > len(paid),
        'pending_list_truncated': pending_total > len(pending),
        'data_source': 'ucu_sourcedb2.payroll',
    }

def _from_dim_employee(engine) -> dict:
    from api.analytics import _HR_DIM_PT_SQL, _hr_admin_role_category_from_pt

    emp_sql = f"""
        SELECT e.employee_id, e.full_name, ({_HR_DIM_PT_SQL}) AS pt
        FROM dim_employee e
        JOIN dim_department ddept ON e.department_id = ddept.department_id
        JOIN dim_faculty df ON ddept.faculty_id = df.faculty_id
    """
    try:
        emps = pd.read_sql_query(text(emp_sql), engine)
    except Exception:
        return _empty_payload()

    if emps is None or emps.empty:
        return _empty_payload()

    latest_pp = date.today().strftime('%Y-%m')
    paid_rows = []
    pending_rows = []
    by_role: dict[str, float] = {}

    for _, row in emps.iterrows():
        eid = int(row['employee_id']) if pd.notna(row.get('employee_id')) else 0
        fn = str(row.get('full_name') or '').strip() or f'Employee {eid}'
        pt = str(row.get('pt') or '')
        rc = _hr_admin_role_category_from_pt(pt)
        is_paid = (eid * 1103515245 + 12345) % 100 < 78
        if is_paid:
            net = float(2_200_000 + (abs(eid) % 55) * 45_000)
            paid_rows.append({
                'employee_id': eid,
                'full_name': fn,
                'net_pay': round(net, 2),
                'pay_period': latest_pp,
                'role_category': rc,
            })
            by_role[rc] = by_role.get(rc, 0.0) + net
        else:
            pending_rows.append({
                'employee_id': eid,
                'full_name': fn,
                'role_category': rc,
            })

    paid_rows.sort(key=lambda x: x['full_name'].lower())
    pending_rows.sort(key=lambda x: x['full_name'].lower())

    payroll_by_role = [
        {
            'role_name': rc,
            'role_category': rc,
            'employee_count': sum(
                1 for p in paid_rows if p['role_category'] == rc
            ),
            'total_net_pay': round(tot, 2),
        }
        for rc, tot in sorted(by_role.items(), key=lambda x: -x[1])
    ]

    total_payroll = round(sum(p['net_pay'] for p in paid_rows), 2)

    paid_out = [
        {
            'employee_id': p['employee_id'],
            'name': p['full_name'],
            'full_name': p['full_name'],
            'username': '',
            'net_pay': p['net_pay'],
            'pay_period': p['pay_period'],
            'role_category': p['role_category'],
        }
        for p in paid_rows[:LIST_LIMIT]
    ]
    pending_out = [
        {
            'employee_id': p['employee_id'],
            'name': p['full_name'],
            'full_name': p['full_name'],
            'username': '',
            'role_category': p['role_category'],
        }
        for p in pending_rows[:LIST_LIMIT]
    ]

    return {
        'payroll_by_role': payroll_by_role,
        'total_payroll': total_payroll,
        'paid': paid_out,
        'pending': pending_out,
        'latest_pay_period': latest_pp,
        'paid_count': len(paid_rows),
        'pending_count': len(pending_rows),
        'paid_list_truncated': len(paid_rows) > LIST_LIMIT,
        'pending_list_truncated': len(pending_rows) > LIST_LIMIT,
        'data_source': 'dim_employee_synthetic',
    }

def build_hr_payroll_overview(engine) -> dict:
    out = _from_mirror_payroll(engine)
    if out is not None:
        return out
    return _from_dim_employee(engine)
