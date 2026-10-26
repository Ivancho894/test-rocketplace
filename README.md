# Rocketplace

Next.js + Supabase (proyecto `rocketplace`). Listado de pedidos multi-tienda con RLS, filtro por estado en la URL y export CSV.

- `/orders?status=paid&page=2` — 50 por página, orden `created_at desc, id desc`. Query inválida => 400.
- `/orders/csv?status=paid` — todo el conjunto filtrado (cursor por lotes de 1000), UTF-8 con BOM, separador `;`, coma decimal, celdas que empiezan por `= + - @` neutralizadas con `'`.
- Aislamiento por tienda con RLS (`supabase/migrations`); la app solo usa la anon/publishable key con el JWT del usuario.

## Puesta en marcha

```
cp .env.example .env.local   # poner la publishable key
npm install
npm run dev
npm test                     # requiere acceso a https://<proyecto>.supabase.co
```

Usuarios de prueba (`supabase/seed.sql`): `a1|a2|b1|b2|c1|c2@test.rocketplace.dev`, contraseña `Rocketplace-test-1!`.
