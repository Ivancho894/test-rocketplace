import type { SupabaseClient } from '@supabase/supabase-js';
import { CSV_BOM, csvRow, formatDecimalEs } from './csv';
import type { OrderParams } from './params';

export const PAGE_SIZE = 50;
export const EXPORT_BATCH_SIZE = 1000;

const COLUMNS = 'id, store_id, status, customer_name, total, created_at';

export type OrderRow = {
  id: string;
  store_id: string;
  status: string;
  customer_name: string;
  total: number;
  created_at: string;
};

type Filters = Pick<OrderParams, 'status' | 'store'>;

// Orden total y estable: created_at no es único, el id desempata.
function baseQuery(client: SupabaseClient, filters: Filters) {
  let query = client
    .from('orders')
    .select(COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.store) query = query.eq('store_id', filters.store);
  return query;
}

export async function listOrders(
  client: SupabaseClient,
  params: OrderParams,
): Promise<{ rows: OrderRow[]; total: number }> {
  const from = (params.page - 1) * PAGE_SIZE;
  const { data, count, error } = await baseQuery(client, params).range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);
  return { rows: (data ?? []) as OrderRow[], total: count ?? 0 };
}

/** Recorre TODO el conjunto filtrado (sin paginar) con paginación por cursor sobre (created_at, id). */
export async function* iterateOrders(
  client: SupabaseClient,
  filters: Filters,
  batchSize = EXPORT_BATCH_SIZE,
): AsyncGenerator<OrderRow[]> {
  let cursor: { created_at: string; id: string } | null = null;
  for (;;) {
    let query = baseQuery(client, filters).limit(batchSize);
    if (cursor) {
      query = query.or(
        `created_at.lt."${cursor.created_at}",and(created_at.eq."${cursor.created_at}",id.lt.${cursor.id})`,
      );
    }
    const { data, error } = await query;
    if (error) throw new Error(`No se pudo exportar los pedidos: ${error.message}`);
    const rows = (data ?? []) as OrderRow[];
    if (rows.length === 0) return;
    yield rows;
    if (rows.length < batchSize) return;
    const last = rows[rows.length - 1];
    cursor = { created_at: last.created_at, id: last.id };
  }
}

const CSV_HEADER = ['id', 'tienda', 'estado', 'cliente', 'total', 'fecha'];

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

export async function* ordersCsvChunks(client: SupabaseClient, filters: Filters): AsyncGenerator<string> {
  yield CSV_BOM + csvRow(CSV_HEADER);
  for await (const rows of iterateOrders(client, filters)) {
    yield rows
      .map((o) =>
        csvRow([o.id, o.store_id, o.status, o.customer_name, formatDecimalEs(Number(o.total)), formatDate(o.created_at)]),
      )
      .join('');
  }
}
