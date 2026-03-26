export const FINANCE_BREAKDOWN_AXIS = ['Tuition', 'Accommodation', 'Library', 'Medical', 'Other'];

export function deriveFinanceBreakdown(data = {}) {
  return FINANCE_BREAKDOWN_AXIS.map((name) => ({
    name,
    value: Number(data[name.toLowerCase()] ?? data[name] ?? 0),
  }));
}
