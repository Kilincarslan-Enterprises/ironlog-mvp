export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)

  if (url.pathname === '/api/health') {
    return Response.json({ status: 'ok', service: 'ironlog', version: '0.1.0' })
  }

  return new Response('Not found', { status: 404 })
}
