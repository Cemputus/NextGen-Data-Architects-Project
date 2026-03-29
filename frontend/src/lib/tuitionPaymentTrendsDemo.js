/**
 * Fallback series when /api/dashboard/tuition-payment-trends-dimensions returns no rows
 * (empty warehouse, API error, or scoped roles with no data). Shape matches SciLineChart data.
 */

export function abbreviateTuitionPeriodLabel(period) {
  const s = String(period ?? '').trim();
  const m = /^Q(\d)\s+(\d{4})$/i.exec(s);
  if (m) return `Q${m[1]}'${m[2].slice(2)}`;
  const m2 = /^Sem\s*(\d+)/i.exec(s);
  if (m2) return `Sem ${m2[1]}`;
  if (s.length > 14) return `${s.slice(0, 12)}…`;
  return s;
}

/**
 * @param {'yearly' | 'quarterly' | 'monthly'} period
 * @returns {Array<{ period: string, faculty_amount: number, department_amount: number, program_amount: number }>}
 */
export function buildDemoTuitionPaymentTrendsDim(period = 'yearly') {
  const p = (period || 'yearly').toString().toLowerCase();
  let rawPeriods;
  if (p === 'monthly') {
    rawPeriods = [
      'January 2024',
      'February 2024',
      'March 2024',
      'April 2024',
      'May 2024',
      'June 2024',
      'July 2024',
      'August 2024',
      'September 2024',
      'October 2024',
      'November 2024',
      'December 2024',
    ];
  } else if (p === 'quarterly') {
    rawPeriods = [
      'Q1 2023',
      'Q2 2023',
      'Q3 2023',
      'Q4 2023',
      'Q1 2024',
      'Q2 2024',
      'Q3 2024',
      'Q4 2024',
    ];
  } else {
    rawPeriods = ['2021', '2022', '2023', '2024', '2025'];
  }

  const base = 1_420_000;
  return rawPeriods.map((rp, i) => {
    const f = base + i * 68_000 + (i % 5) * 31_000;
    return {
      period: abbreviateTuitionPeriodLabel(rp),
      faculty_amount: Math.round(f * 100) / 100,
      department_amount: Math.round(f * 0.96 * 100) / 100,
      program_amount: Math.round(f * 0.91 * 100) / 100,
    };
  });
}
