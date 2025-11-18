export async function GET() {
  return new Response(JSON.stringify({ now: Date.now() }), {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
    },
  });
}
