import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listOrders, PAGE_SIZE } from '@/lib/orders';
import { ORDER_STATUSES, parseOrderParams } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

type SearchParams = Record<string, string | string[] | undefined>;

function toUrlSearchParams(sp: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) out.append(key, v);
  }
  return out;
}

function href(path: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const parsed = parseOrderParams(toUrlSearchParams(await searchParams));
  // El middleware ya responde 400; esto cubre cualquier acceso que lo esquive.
  if (!parsed.ok) throw new Error(parsed.error);
  const params = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { rows, total } = await listOrders(supabase, params);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const keep = { status: params.status, store: params.store };

  return (
    <main>
      <h1>Pedidos</h1>
      <nav style={{ display: 'flex', gap: '1rem', margin: '1rem 0' }}>
        <Link href={href('/orders', { store: params.store })}>Todos</Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={href('/orders', { status: s, store: params.store })}>
            {s}
          </Link>
        ))}
        <a href={href('/orders/csv', keep)}>Descargar CSV</a>
      </nav>
      <p>
        {total} pedidos · página {params.page} de {pages}
      </p>
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Estado</th>
            <th>Cliente</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>{o.created_at}</td>
              <td>{o.status}</td>
              <td style={{ whiteSpace: 'pre-line' }}>{o.customer_name}</td>
              <td>{o.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ display: 'flex', gap: '1rem' }}>
        {params.page > 1 && <Link href={href('/orders', { ...keep, page: params.page - 1 })}>← Anterior</Link>}
        {params.page < pages && <Link href={href('/orders', { ...keep, page: params.page + 1 })}>Siguiente →</Link>}
      </p>
    </main>
  );
}
