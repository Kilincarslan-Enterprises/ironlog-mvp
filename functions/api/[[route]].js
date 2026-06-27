export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)

  if (url.pathname === '/api/health') {
    return Response.json({ status: 'ok', service: 'ironlog' })
  }

  if (url.pathname === '/api/logs' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, message, level, created_at FROM logs ORDER BY created_at DESC LIMIT 100'
    ).all()
    return Response.json(results ?? [])
  }

  if (url.pathname === '/api/logs' && request.method === 'POST') {
    const body = await request.json()
    const level = body.level ?? 'info'
    const { meta } = await env.DB.prepare(
      'INSERT INTO logs (message, level) VALUES (?, ?)'
    )
      .bind(body.message, level)
      .run()
    return Response.json({ id: meta.last_row_id }, { status: 201 })
  }

  return new Response('Not found', { status: 404 })
}
