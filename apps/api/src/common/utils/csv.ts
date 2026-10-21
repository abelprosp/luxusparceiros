const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Célula CSV entre aspas e neutralizada contra fórmulas (Excel/Sheets executam =, +, -, @). */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}
