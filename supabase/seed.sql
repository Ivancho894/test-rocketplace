-- Datos de prueba: 3 tiendas, 2 usuarios por tienda, pedidos en todas (A: 150, B: 60, C: 45).
-- Usuarios de prueba, contraseña común: Rocketplace-test-1!
-- Sin deletes; re-ejecutable: los inserts usan on conflict do nothing y los pedidos solo se crean si la tienda no tiene.

insert into public.stores (id, name) values
  ('a0000000-0000-4000-8000-000000000001', 'Tienda A'),
  ('b0000000-0000-4000-8000-000000000002', 'Tienda B'),
  ('c0000000-0000-4000-8000-000000000003', 'Tienda C')
on conflict (id) do nothing;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Rocketplace-test-1!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'a1@test.rocketplace.dev'),
  ('a2000000-0000-4000-8000-000000000002'::uuid, 'a2@test.rocketplace.dev'),
  ('b1000000-0000-4000-8000-000000000003'::uuid, 'b1@test.rocketplace.dev'),
  ('b2000000-0000-4000-8000-000000000004'::uuid, 'b2@test.rocketplace.dev'),
  ('c1000000-0000-4000-8000-000000000005'::uuid, 'c1@test.rocketplace.dev'),
  ('c2000000-0000-4000-8000-000000000006'::uuid, 'c2@test.rocketplace.dev')
) as u(id, email)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users where email like '%@test.rocketplace.dev'
on conflict (provider_id, provider) do nothing;

insert into public.store_members (user_id, store_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002'),
  ('b2000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002'),
  ('c1000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003'),
  ('c2000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000003')
on conflict do nothing;

-- Nombres con tildes, comas, comillas, saltos de línea y prefijos de fórmula (= + - @).
-- created_at se repite en grupos de 4 pedidos para ejercitar el desempate por id.
insert into public.orders (store_id, status, customer_name, total, created_at)
select s.store_id,
  (array['pending', 'paid', 'shipped', 'cancelled'])[1 + (g % 4)]::public.order_status,
  (array[
    'José Ángel Muñoz',
    'García, María',
    'Pedro "El Grande" López',
    E'Ana\nBelén Ruiz',
    'Niño, Peña y Compañía S.L.',
    E'Lucía "Lu"\nFernández, Gómez',
    '=SUMA(1;1) Carlos',
    '+34 600 123 456 Soledad',
    '-Raúl Núñez',
    '@Sofía Bañuelos',
    'Plain Customer'
  ])[1 + (g % 11)] || ' #' || g,
  round((10 + (g * 7.31)::numeric % 990), 2),
  timestamptz '2026-09-01 12:00:00+00' + ((g / 4) * interval '37 minutes')
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 150),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 60),
  ('c0000000-0000-4000-8000-000000000003'::uuid, 45)
) as s(store_id, n)
cross join lateral generate_series(1, s.n) as g
where not exists (select 1 from public.orders o where o.store_id = s.store_id);
