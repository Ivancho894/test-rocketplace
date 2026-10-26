import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { parseOrderParams } from '@/lib/params';

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Query inválida => 400 (tanto en el listado como en el CSV).
  if (pathname === '/orders' || pathname === '/orders/csv') {
    const parsed = parseOrderParams(searchParams);
    if (!parsed.ok) return new NextResponse(parsed.error, { status: 400 });
  }

  // Renueva la sesión de Supabase en cada petición.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
