// Formato pensado para Excel en español: BOM UTF-8, separador ";", fin de línea CRLF.
export const CSV_BOM = '﻿';
export const CSV_SEPARATOR = ';';
export const CSV_EOL = '\r\n';

/** Evita inyección de fórmulas: las celdas que empiezan por = + - @ se prefijan con una comilla simple. */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

/** Neutraliza y aplica el entrecomillado RFC 4180 cuando hace falta. */
export function csvCell(value: string): string {
  const safe = neutralizeFormula(value);
  return /[;,"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(CSV_SEPARATOR) + CSV_EOL;
}

/** 1234.5 -> "1234,50" (coma decimal, como espera Excel en español). */
export function formatDecimalEs(value: number): string {
  return value.toFixed(2).replace('.', ',');
}
