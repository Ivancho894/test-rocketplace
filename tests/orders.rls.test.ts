import { parse } from 'csv-parse/sync';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CSV_BOM } from '@/lib/csv';
import { iterateOrders, listOrders, ordersCsvChunks, PAGE_SIZE, type OrderRow } from '@/lib/orders';
import { ORDER_STATUSES } from '@/lib/params';
import { anonClient, collect, signedInClient, STORE_A, STORE_B, STORE_C } from './helpers';

let userA: SupabaseClient;
let userB: SupabaseClient;

beforeAll(async () => {
  userA = await signedInClient('a1@test.rocketplace.dev');
  userB = await signedInClient('b1@test.rocketplace.dev');
});

function parseCsv(text: string): string[][] {
  expect(text.startsWith(CSV_BOM)).toBe(true);
  return parse(text.slice(1), { delimiter: ';', relax_column_count: false }) as string[][];
}

async function allPages(client: SupabaseClient, status?: (typeof ORDER_STATUSES)[number]) {
  const first = await listOrders(client, { page: 1, status });
  const pages = Math.ceil(first.total / PAGE_SIZE);
  const rows: OrderRow[] = [...first.rows];
  for (let page = 2; page <= pages; page++) rows.push(...(await listOrders(client, { page, status })).rows);
  return { rows, total: first.total, pages };
}

describe('a. aislamiento entre tiendas (RLS)', () => {
  it('el usuario de A pide pedidos de B y recibe 0 filas', async () => {
    const result = await listOrders(userA, { page: 1, store: STORE_B });
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('el usuario de A pide el CSV de B y solo recibe la cabecera', async () => {
    const rows = parseCsv(await collect(ordersCsvChunks(userA, { store: STORE_B })));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(['id', 'tienda', 'estado', 'cliente', 'total', 'fecha']);
  });

  it('sin filtro de tienda, el usuario de A solo ve la tienda A (listado y CSV)', async () => {
    const { rows, total } = await allPages(userA);
    expect(total).toBe(150);
    expect(new Set(rows.map((r) => r.store_id))).toEqual(new Set([STORE_A]));

    const csv = parseCsv(await collect(ordersCsvChunks(userA, {})));
    expect(new Set(csv.slice(1).map((r) => r[1]))).toEqual(new Set([STORE_A]));
  });

  it('el usuario de B solo ve la tienda B, y la de A le da 0 filas', async () => {
    expect((await allPages(userB)).total).toBe(60);
    expect((await listOrders(userB, { page: 1, store: STORE_A })).total).toBe(0);
    expect((await listOrders(userB, { page: 1, store: STORE_C })).total).toBe(0);
  });

  it('un usuario no ve las otras tiendas ni sus membresías', async () => {
    const stores = await userA.from('stores').select('id');
    expect(stores.data?.map((s) => s.id)).toEqual([STORE_A]);
    const members = await userA.from('store_members').select('store_id');
    expect(new Set(members.data?.map((m) => m.store_id))).toEqual(new Set([STORE_A]));
  });

  it('sin sesión (anon) no se ve nada', async () => {
    const anon = anonClient();
    const { data } = await anon.from('orders').select('id');
    expect(data ?? []).toHaveLength(0);
    expect(await collect(ordersCsvChunks(anon, {})).catch(() => 'denegado')).toSatisfy(
      (out: string) => out === 'denegado' || parseCsv(out).length === 1,
    );
  });

  it('no se puede escribir con la anon key + sesión de usuario', async () => {
    const insert = await userA.from('orders').insert({ store_id: STORE_B, customer_name: 'x', total: 1 });
    expect(insert.error).not.toBeNull();
    const update = await userA.from('orders').update({ status: 'paid' }).eq('store_id', STORE_A).select('id');
    expect(update.error !== null || (update.data ?? []).length === 0).toBe(true);
  });
});

describe('b. el CSV contiene todas las filas del filtro', () => {
  it.each([undefined, ...ORDER_STATUSES])('filtro status=%s: filas del CSV == total del listado', async (status) => {
    const { total } = await listOrders(userA, { page: 1, status });
    const csv = parseCsv(await collect(ordersCsvChunks(userA, { status })));
    expect(total).toBeGreaterThan(PAGE_SIZE === 50 && !status ? 100 : 0);
    expect(csv.length - 1).toBe(total);
    if (status) expect(new Set(csv.slice(1).map((r) => r[2]))).toEqual(new Set([status]));
  });

  it('exporta más de una página y sin duplicados aunque el lote sea pequeño', async () => {
    const ids: string[] = [];
    for await (const batch of iterateOrders(userA, {}, 7)) ids.push(...batch.map((r) => r.id));
    expect(ids).toHaveLength(150);
    expect(new Set(ids).size).toBe(150);
  });

  it('los nombres con tildes, comas, comillas y saltos de línea sobreviven al CSV', async () => {
    const { rows } = await allPages(userA);
    const byId = new Map(rows.map((r) => [r.id, r.customer_name]));
    const csv = parseCsv(await collect(ordersCsvChunks(userA, {}))).slice(1);

    expect(csv).toHaveLength(rows.length);
    for (const [id, , , cliente] of csv) {
      const original = byId.get(id)!;
      const expected = /^[=+\-@]/.test(original) ? `'${original}` : original;
      expect(cliente).toBe(expected);
    }

    const names = csv.map((r) => r[3]);
    expect(names.some((n) => /[áéíóúñÁÑ]/.test(n))).toBe(true);
    expect(names.some((n) => n.includes(','))).toBe(true);
    expect(names.some((n) => n.includes('"'))).toBe(true);
    expect(names.some((n) => n.includes('\n'))).toBe(true);
  });

  it('ninguna celda de texto empieza por = + - @ (neutralizadas)', async () => {
    const csv = parseCsv(await collect(ordersCsvChunks(userA, {}))).slice(1);
    for (const row of csv) for (const cell of row) expect(cell).not.toMatch(/^[=+\-@]/);
    expect(csv.some((r) => r[3].startsWith("'="))).toBe(true);
    expect(csv.some((r) => r[3].startsWith("'+"))).toBe(true);
    expect(csv.some((r) => r[3].startsWith("'-"))).toBe(true);
    expect(csv.some((r) => r[3].startsWith("'@"))).toBe(true);
  });

  it('total con coma decimal', async () => {
    const csv = parseCsv(await collect(ordersCsvChunks(userA, {}))).slice(1);
    for (const row of csv) expect(row[4]).toMatch(/^\d+,\d{2}$/);
  });
});

describe('c. orden estable entre páginas', () => {
  it('páginas de 50, sin duplicados ni huecos, en orden total (created_at desc, id desc)', async () => {
    const { rows, total, pages } = await allPages(userA);
    expect(total).toBe(150);
    expect(pages).toBe(3);
    expect(rows).toHaveLength(150);
    expect(new Set(rows.map((r) => r.id)).size).toBe(150);

    // El seed repite created_at: sin desempate por id este test sería frágil.
    expect(new Set(rows.map((r) => r.created_at)).size).toBeLessThan(150);

    const expected = [...rows].sort((x, y) =>
      x.created_at === y.created_at ? (x.id < y.id ? 1 : -1) : x.created_at < y.created_at ? 1 : -1,
    );
    expect(rows.map((r) => r.id)).toEqual(expected.map((r) => r.id));
  });

  it('pedir la misma página dos veces da el mismo resultado', async () => {
    const first = await listOrders(userA, { page: 2 });
    const second = await listOrders(userA, { page: 2 });
    expect(first.rows.map((r) => r.id)).toEqual(second.rows.map((r) => r.id));
    expect(first.rows).toHaveLength(PAGE_SIZE);
  });

  it('el CSV sigue el mismo orden que el listado paginado', async () => {
    const { rows } = await allPages(userA);
    const csv = parseCsv(await collect(ordersCsvChunks(userA, {}))).slice(1);
    expect(csv.map((r) => r[0])).toEqual(rows.map((r) => r.id));
  });
});
