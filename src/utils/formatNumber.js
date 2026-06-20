/**
 * Formats a number using Turkish locale (tr-TR) grouping.
 *
 * @param {number} value - The number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(value);
}
