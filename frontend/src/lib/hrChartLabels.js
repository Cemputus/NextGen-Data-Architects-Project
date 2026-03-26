export function abbreviateOrgLabel(label = '', maxLen = 20) {
  if (!label) return '';
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + '…';
}
