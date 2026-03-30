export const UCU_COLORS = {
  blue: '#2563eb', purple: '#7c3aed', green: '#059669', orange: '#ea580c',
  red: '#dc2626', cyan: '#0891b2', gold: '#ca8a04', pink: '#db2777',
  indigo: '#4f46e5', teal: '#0d9488',
};

export const CHART_PALETTE_THEME = [
  '#2563eb','#7c3aed','#059669','#ea580c','#dc2626',
  '#0891b2','#ca8a04','#db2777','#4f46e5','#0d9488',
];

export const MODERN_CHART_PALETTE = [
  '#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444',
  '#06b6d4','#f97316','#ec4899','#6366f1','#14b8a6',
];

export const defaultTextStyle = {
  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, color: '#64748b',
};

export const defaultTitleTextStyle = {
  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: 600, color: '#1e293b',
};

export const defaultGrid = { top: 32, right: 16, bottom: 40, left: 48, containLabel: true };

export const defaultTooltip = {
  trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#334155',
  borderWidth: 1, textStyle: { color: '#f1f5f9', fontSize: 12 }, confine: true,
};

export function formatCompactNumber(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';

  const sign = n < 0 ? '-' : '';
  const x = Math.abs(n);

  if (x < 1000) {
    if (Number.isInteger(n)) return `${sign}${Math.trunc(x)}`;
    const rounded = Math.round(x * 100) / 100;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
      return `${sign}${Math.round(rounded)}`;
    }
    return `${sign}${rounded.toFixed(2).replace(/\.?0+$/, '')}`;
  }

  const tiers = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [div, suf] of tiers) {
    if (x >= div) {
      const d = x / div;
      let s;
      if (d >= 100) s = d.toFixed(0);
      else if (d >= 10) s = d.toFixed(1);
      else s = d.toFixed(2);
      s = s.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
      return `${sign}${s}${suf}`;
    }
  }
  return `${sign}${x}`;
}

export function formatTooltipValue(value, isPercent = false) {
  if (value == null) return '—';
  if (isPercent) return `${Number(value).toFixed(1)}%`;
  return formatCompactNumber(value);
}
