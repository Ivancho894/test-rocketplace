import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function signIn(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error) redirect('/login?error=1');
  redirect('/orders');
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={signIn} style={{ display: 'grid', gap: '0.5rem', maxWidth: 320 }}>
      <h1>Entrar</h1>
      {error && <p role="alert">Credenciales incorrectas</p>}
      <input name="email" type="email" placeholder="email" required />
      <input name="password" type="password" placeholder="contraseña" required />
      <button type="submit">Entrar</button>
    </form>
  );
}
