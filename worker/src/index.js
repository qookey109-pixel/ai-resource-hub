const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/qookey109-pixel/ai-resource-hub/main/data/resources.json';
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const SITE_ORIGIN = 'https://qookey109-pixel.github.io';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

function corsOrigin(request, env) {
  const origin = request.headers.get('origin') || '';
  const configured = String(env.ALLOWED_ORIGIN || SITE_ORIGIN).trim();
  if (!origin) return configured;
  if (origin === configured) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return '';
}

function corsHeaders(request, env) {
  const origin = corsOrigin(request, env);
  return origin
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'vary': 'Origin'
      }
    : {};
}

function compactResource(resource) {
  return {
    id: resource.id,
    name: resource.name,
    categories: resource.categories || [],
    summary: resource.summary || '',
    use_cases: resource.use_cases || [],
    pricing: resource.pricing || 'unknown',
    open_source: resource.open_source ?? null,
    rating: resource.rating ?? null,
    url: resource.url
  };
}

async function loadCatalog(env) {
  const url = String(env.CATALOG_URL || DEFAULT_CATALOG_URL);
  const response = await fetch(url, {
    headers: { 'user-agent': 'Qookey-AI-Resource-Recommender/0.1' },
    cf: { cacheTtl: 300, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`catalog fetch failed: ${response.status}`);
  const body = await response.json();
  return Array.isArray(body.resources) ? body.resources : [];
}

function extractText(result) {
  if (typeof result === 'string') return result;
  if (typeof result?.response === 'string') return result.response;
  if (typeof result?.result?.response === 'string') return result.result.response;
  return JSON.stringify(result ?? '');
}

function parseJsonObject(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('model did not return JSON');
  }
}

function normalise(value) {
  return String(value || '').toLowerCase();
}

function fallbackRecommendations(query, resources) {
  const terms = normalise(query)
    .split(/[^\p{L}\p{N}+#.-]+/u)
    .filter((term) => term.length >= 2);

  const scored = resources.map((resource) => {
    const haystack = normalise([
      resource.name,
      resource.summary,
      ...(resource.categories || []),
      ...(resource.tags || []),
      ...(resource.use_cases || [])
    ].join(' '));
    let score = Number(resource.rating || 0) * 0.2;
    for (const term of terms) {
      if (haystack.includes(term)) score += term.length >= 4 ? 3 : 1.5;
    }
    return { resource, score };
  });

  scored.sort((a, b) => b.score - a.score || Number(b.resource.rating || 0) - Number(a.resource.rating || 0));

  return scored.slice(0, 5).map(({ resource }) => ({
    id: resource.id,
    role: '候選資源',
    reason: resource.summary || '與你的任務關鍵字相符。',
    how_to_use: resource.use_cases?.[0] || '先查看專案說明與使用方式。'
  }));
}

function validateModelOutput(output, resources) {
  const known = new Map(resources.map((resource) => [resource.id, resource]));
  const recommendations = Array.isArray(output?.recommendations)
    ? output.recommendations
        .filter((item) => item && known.has(item.id))
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          role: String(item.role || '推薦資源').slice(0, 30),
          reason: String(item.reason || '').slice(0, 220),
          how_to_use: String(item.how_to_use || '').slice(0, 220)
        }))
    : [];

  return {
    intent_summary: String(output?.intent_summary || '').slice(0, 220),
    recommendations,
    stack_plan: Array.isArray(output?.stack_plan)
      ? output.stack_plan.slice(0, 5).map((item) => String(item).slice(0, 220))
      : [],
    caveats: Array.isArray(output?.caveats)
      ? output.caveats.slice(0, 4).map((item) => String(item).slice(0, 220))
      : []
  };
}

function buildPrompt(query, resources) {
  const catalog = resources.map(compactResource);
  return [
    '你是 Qookey AI Resource Hub 的資源推薦器。',
    '只能從下方 catalog 中推薦，不得創造不存在的資源、ID、價格或功能。',
    '請以繁體中文回答。根據使用者任務，挑選 3 到 5 個最有幫助的資源。',
    '若需要多個工具搭配，請說明各自角色與使用順序。',
    '不得把 rating 當成唯一排序依據；以任務適配度為主。',
    '輸出必須是單一 JSON object，不要 Markdown，不要 code fence。',
    'JSON schema:',
    '{"intent_summary":"一句話理解任務","recommendations":[{"id":"catalog 中的 id","role":"核心/輔助/部署/資料等","reason":"為什麼適合","how_to_use":"如何用在此任務"}],"stack_plan":["步驟 1","步驟 2"],"caveats":["限制或注意事項"]}',
    '',
    `使用者任務：${query}`,
    '',
    `catalog：${JSON.stringify(catalog)}`
  ].join('\n');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      if (!cors['access-control-allow-origin']) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'qookey-ai-resource-recommender', model: env.MODEL || DEFAULT_MODEL }, 200, cors);
    }

    if (request.method !== 'POST' || url.pathname !== '/api/recommend') {
      return json({ error: 'not_found' }, 404, cors);
    }

    if (!cors['access-control-allow-origin']) {
      return json({ error: 'origin_not_allowed' }, 403);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_json' }, 400, cors);
    }

    const query = String(body?.query || '').trim();
    if (query.length < 2 || query.length > 500) {
      return json({ error: 'query_length', message: 'query must be 2-500 characters' }, 400, cors);
    }

    let resources;
    try {
      resources = await loadCatalog(env);
    } catch (error) {
      return json({ error: 'catalog_unavailable', message: String(error.message || error) }, 503, cors);
    }

    if (!resources.length) {
      return json({ error: 'catalog_empty' }, 503, cors);
    }

    try {
      const result = await env.AI.run(env.MODEL || DEFAULT_MODEL, {
        prompt: buildPrompt(query, resources)
      });
      const parsed = parseJsonObject(extractText(result));
      const validated = validateModelOutput(parsed, resources);
      if (!validated.recommendations.length) throw new Error('no valid catalog IDs returned');

      return json({
        ok: true,
        mode: 'ai',
        query,
        ...validated
      }, 200, cors);
    } catch (error) {
      const recommendations = fallbackRecommendations(query, resources);
      return json({
        ok: true,
        mode: 'fallback',
        query,
        intent_summary: 'AI 推論暫時無法完成，以下先依資源內容與關鍵字提供候選。',
        recommendations,
        stack_plan: [],
        caveats: ['這次是備援排序，建議稍後重新執行 AI 推薦。'],
        diagnostic: String(error.message || error).slice(0, 180)
      }, 200, cors);
    }
  }
};
