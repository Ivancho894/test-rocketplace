import { ordersCsvChunks } from '@/lib/orders';
import { parseOrderParams } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const parsed = parseOrderParams(new URL(request.url).searchParams);
  if (!parsed.ok) return new Response(parsed.error, { status: 400 });
  const { status, store } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response('No autenticado', { status: 401 });

  const chunks = ordersCsvChunks(supabase, { status, store });
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await chunks.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (err) {
        // Cortar el stream con error: mejor una descarga fallida que un CSV truncado que parezca completo.
        controller.error(err);
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pedidos-${status ?? 'todos'}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
