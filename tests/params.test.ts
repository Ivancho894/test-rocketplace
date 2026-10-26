import { describe, expect, it } from 'vitest';
import { parseOrderParams } from '@/lib/params';

const parse = (qs: string) => parseOrderParams(new URLSearchParams(qs));

describe('parseOrderParams', () => {
  it('acepta los estados permitidos y página por defecto 1', () => {
    expect(parse('status=paid')).toEqual({ ok: true, data: { status: 'paid', page: 1 } });
    expect(parse('')).toEqual({ ok: true, data: { page: 1 } });
  });

  it.each(['status=foo', 'status=', 'status=PAID', 'status=paid&status=shipped', 'page=0', 'page=-1', 'page=1e2', 'page=abc', 'page=', 'store=nope'])(
    'rechaza %s',
    (qs) => {
      expect(parse(qs).ok).toBe(false);
    },
  );
});
