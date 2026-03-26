/**
 * Label helpers for HR charts (department/faculty names).
 */

/**
 * Truncates long org unit labels for chart axes.
 * @param {string} label
 * @param {number} maxLen
 * @returns {string}
 */
export function abbreviateOrgLabel(label = '', maxLen = 20) {
  if (!label) return '';
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + '…';
}
