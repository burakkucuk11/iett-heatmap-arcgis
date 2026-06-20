/**
 * Builds a SQL WHERE clause for filtering IETT stops by text value.
 * Searches across ADI, DURAK_KODU, DURAK_TIPI, YON_BILGISI, and ILCEID fields.
 *
 * @param {string} value - The search text
 * @returns {string} SQL WHERE clause
 */
export function buildStopFilter(value) {
  if (!value) {
    return "1=1";
  }

  const safeValue = value
    .replaceAll("'", "''")
    .replaceAll("%", "")
    .replaceAll("_", "\\_")
    .replaceAll("-", "")
    .replaceAll(";", "")
    .replace(/[\x00-\x1f]/g, "");

  return `UPPER(ADI) LIKE UPPER('%${safeValue}%') OR UPPER(DURAK_KODU) LIKE UPPER('%${safeValue}%') OR UPPER(DURAK_TIPI) LIKE UPPER('%${safeValue}%') OR UPPER(YON_BILGISI) LIKE UPPER('%${safeValue}%') OR CAST(ILCEID AS VARCHAR(20)) LIKE '%${safeValue}%'`;
}
