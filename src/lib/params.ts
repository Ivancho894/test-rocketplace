import { z } from 'zod';

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderParams = {
  status?: OrderStatus;
  store?: string;
  page: number;
};

export type ParseResult = { ok: true; data: OrderParams } | { ok: false; error: string };

const statusSchema = z.enum(ORDER_STATUSES);
const storeSchema = z.uuid();

/** Valida la query string de /orders y /orders/csv. Cualquier valor no permitido es un error (400). */
export function parseOrderParams(sp: URLSearchParams): ParseResult {
  for (const key of ['status', 'store', 'page']) {
    if (sp.getAll(key).length > 1) return { ok: false, error: `Parámetro repetido: ${key}` };
  }

  const data: OrderParams = { page: 1 };

  if (sp.has('status')) {
    const parsed = statusSchema.safeParse(sp.get('status'));
    if (!parsed.success) {
      return { ok: false, error: `status inválido. Valores permitidos: ${ORDER_STATUSES.join(', ')}` };
    }
    data.status = parsed.data;
  }

  if (sp.has('store')) {
    const parsed = storeSchema.safeParse(sp.get('store'));
    if (!parsed.success) return { ok: false, error: 'store debe ser un UUID' };
    data.store = parsed.data;
  }

  if (sp.has('page')) {
    const raw = sp.get('page') ?? '';
    if (!/^[1-9]\d{0,6}$/.test(raw)) return { ok: false, error: 'page debe ser un entero >= 1' };
    data.page = Number(raw);
  }

  return { ok: true, data };
}
