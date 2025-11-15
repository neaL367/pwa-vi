export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(JSON.stringify({ now: Date.now() }), {
    headers: { "Content-Type": "application/json" },
  });
}