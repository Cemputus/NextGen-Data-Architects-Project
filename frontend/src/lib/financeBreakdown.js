/**
 * Helpers for deriving finance breakdown chart data from API responses.
 */

export const FINANCE_BREAKDOWN_AXIS = ['Tuition', 'Accommodation', 'Library', 'Medical', 'Other'];

/**
 * Derives a bar-chart-ready breakdown array from a finance summary object.
 * @param {object} data - API response with fee category totals
 * @returns {{ name: string, value: number }[]}
 */
export function deriveFinanceBreakdown(data = {}) {
  return FINANCE_BREAKDOWN_AXIS.map((name) => ({
    name,
    value: Number(data[name.toLowerCase()] ?? data[name] ?? 0),
  }));
}
