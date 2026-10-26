import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const STORE_A = 'a0000000-0000-4000-8000-000000000001';
export const STORE_B = 'b0000000-0000-4000-8000-000000000002';
export const STORE_C = 'c0000000-0000-4000-8000-000000000003';
export const TEST_PASSWORD = 'Rocketplace-test-1!';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cliente anónimo (sin sesión). Nunca se usa la service key. */
export function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Cliente con sesión real de un usuario de prueba: el JWT viaja y RLS decide. */
export async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`Login de ${email} fallido: ${error.message}`);
  return client;
}

export async function collect(chunks: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of chunks) out += chunk;
  return out;
}
