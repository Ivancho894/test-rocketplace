import { describe, expect, it } from 'vitest';
import { csvCell, csvRow, formatDecimalEs, neutralizeFormula } from '@/lib/csv';

describe('csv', () => {
  it.each(['=1+1', '+34 600', '-5', '@SUM(A1)'])('neutraliza %s', (v) => {
    expect(neutralizeFormula(v)).toBe(`'${v}`);
  });

  it('no toca el resto', () => {
    expect(neutralizeFormula('José')).toBe('José');
    expect(neutralizeFormula('a=b')).toBe('a=b');
  });

  it('entrecomilla separador, comas, comillas y saltos de línea', () => {
    expect(csvCell('García, María')).toBe('"García, María"');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell('uno\ndos')).toBe('"uno\ndos"');
  });

  it('neutraliza antes de entrecomillar', () => {
    expect(csvCell('=A,B')).toBe(`"'=A,B"`);
  });

  it('usa ; y CRLF; coma decimal', () => {
    expect(csvRow(['a', 'b'])).toBe('a;b\r\n');
    expect(formatDecimalEs(1234.5)).toBe('1234,50');
  });
});
