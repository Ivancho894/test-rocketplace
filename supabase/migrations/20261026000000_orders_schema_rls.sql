create type public.order_status as enum ('pending', 'paid', 'shipped', 'cancelled');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table public.store_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  primary key (user_id, store_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  status public.order_status not null default 'pending',
  customer_name text not null,
  total numeric(12, 2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

-- listado paginado y export: filtro por tienda/estado, orden estable (created_at desc, id desc)
create index orders_store_created_idx on public.orders (store_id, created_at desc, id desc);
create index orders_store_status_created_idx on public.orders (store_id, status, created_at desc, id desc);

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.orders enable row level security;

-- solo lectura para usuarios autenticados; anon no toca nada
revoke all on public.stores, public.store_members, public.orders from anon, authenticated;
grant select on public.stores, public.store_members, public.orders to authenticated;

create policy store_members_select_own on public.store_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy stores_select_member on public.stores
  for select to authenticated
  using (id in (select store_id from public.store_members where user_id = (select auth.uid())));

create policy orders_select_member on public.orders
  for select to authenticated
  using (store_id in (select store_id from public.store_members where user_id = (select auth.uid())));
