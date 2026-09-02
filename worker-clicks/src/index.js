import { DurableObject } from 'cloudflare:workers';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

function allowedOrigin(request, env) {
  const origin = request.headers.get('origin') || '';
  const configured = String(env.ALLOWED_ORIGIN || 'https://qookey109-pixel.github.io');
  if (!origin) return configured;
  if (origin === configured) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return '';
}

function json(data, status, request, env) {
  const origin = allowedOrigin(request, env);
  const headers = { ...JSON_HEADERS };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    headers['access-control-allow-headers'] = 'content-type';
    headers.vary = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function validResourceId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}

export class ResourceClickCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS resource_clicks (
        resource_id TEXT PRIMARY KEY,
        click_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async fetch(request) {
    if (request.method === 'GET') {
      const rows = Array.from(this.ctx.storage.sql.exec(
        'SELECT resource_id, click_count FROM resource_clicks ORDER BY resource_id'
      ));
      const counts = Object.fromEntries(rows.map((row) => [row.resource_id, Number(row.click_count || 0)]));
      return new Response(JSON.stringify({ ok: true, counts }), { headers: JSON_HEADERS });
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), { status: 400, headers: JSON_HEADERS });
      }

      const resourceId = String(body?.resource_id || '').trim();
      if (!validResourceId(resourceId)) {
        return new Response(JSON.stringify({ ok: false, error: 'invalid_resource_id' }), { status: 400, headers: JSON_HEADERS });
      }

      const rows = Array.from(this.ctx.storage.sql.exec(
        `INSERT INTO resource_clicks (resource_id, click_count, updated_at)
         VALUES (?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(resource_id) DO UPDATE SET
           click_count = resource_clicks.click_count + 1,
           updated_at = CURRENT_TIMESTAMP
         RETURNING click_count`,
        resourceId
      ));
      const count = Number(rows[0]?.click_count || 1);
      return new Response(JSON.stringify({ ok: true, resource_id: resourceId, count }), { headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405, headers: JSON_HEADERS });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);

    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          vary: 'Origin'
        }
      });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, service: 'qookey-resource-clicks' }, 200, request, env);
    }

    if (url.pathname !== '/api/resource-clicks') {
      return json({ ok: false, error: 'not_found' }, 404, request, env);
    }

    if (!origin && request.headers.get('origin')) {
      return json({ ok: false, error: 'origin_not_allowed' }, 403, request, env);
    }

    if (!['GET', 'POST'].includes(request.method)) {
      return json({ ok: false, error: 'method_not_allowed' }, 405, request, env);
    }

    const id = env.RESOURCE_CLICK_COUNTER.idFromName('global-resource-clicks');
    const stub = env.RESOURCE_CLICK_COUNTER.get(id);
    const upstream = await stub.fetch(request);
    let payload;
    try {
      payload = await upstream.json();
    } catch {
      return json({ ok: false, error: 'counter_unavailable' }, 502, request, env);
    }
    return json(payload, upstream.status, request, env);
  }
};
