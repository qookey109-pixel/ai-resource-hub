const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/qookey109-pixel/ai-resource-hub/main/data/resources.json';
const DEFAULT_MODEL = '@cf/zai-org/glm-4.7-flash';
const SITE_ORIGIN = 'https://qookey109-pixel.github.io';
const RECOMMENDER_VERSION = '0.3.9';
const AI_RUN_OPTIONS = Object.freeze({ rejectIfBusy: true });
const AI_REASONING_EFFORT = 'low';
const INTENT_MAX_COMPLETION_TOKENS = 480;
const RANKING_CANDIDATE_LIMIT = 18;
const RANKING_MIN_CANDIDATES = 8;

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

function timingSnapshot(requestStarted, catalogMs, intentMs, rankingMs) {
  return {
    catalog: catalogMs,
    intent: intentMs,
    ranking: rankingMs,
    total: Date.now() - requestStarted
  };
}

function compactResource(resource) {
  return {
    id: resource.id,
    name: resource.name,
    type: resource.type,
    categories: resource.categories || [],
    tags: resource.tags || [],
    summary: resource.summary || '',
    use_cases: resource.use_cases || [],
    pricing: resource.pricing || 'unknown',
    open_source: resource.open_source ?? null,
    difficulty: resource.difficulty || 'unknown',
    status: resource.status || 'unknown',
    rating: resource.rating ?? null,
    notes: resource.notes || '',
    url: resource.url
  };
}

async function loadCatalog(env) {
  const url = String(env.CATALOG_URL || DEFAULT_CATALOG_URL);
  const response = await fetch(url, {
    headers: { 'user-agent': `Qookey-AI-Resource-Recommender/${RECOMMENDER_VERSION}` },
    cf: { cacheTtl: 300, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`catalog fetch failed: ${response.status}`);
  const body = await response.json();
  return Array.isArray(body.resources) ? body.resources : [];
}

function extractText(result) {
  if (typeof result === 'string') return result;
  if (typeof result?.response === 'string') return result.response;
  if (typeof result?.choices?.[0]?.message?.content === 'string') return result.choices[0].message.content;
  if (typeof result?.choices?.[0]?.text === 'string') return result.choices[0].text;
  if (typeof result?.result?.response === 'string') return result.result.response;
  if (typeof result?.result?.choices?.[0]?.message?.content === 'string') return result.result.choices[0].message.content;
  return JSON.stringify(result ?? '');
}

function parseJsonObject(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (start < 0) {
      if (char !== '{') continue;
      start = index;
      depth = 1;
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return JSON.parse(trimmed.slice(start, index + 1));
    }
  }

  throw new Error('model did not return a complete JSON object');
}

function cleanString(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function isProviderQuotaExhausted(error) {
  const message = String(error?.message || error || '');
  return /\b4006\b|daily free allocation|used up.*neurons/i.test(message);
}

function cleanList(value, limit = 8, itemMax = 120) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, itemMax))
    .filter(Boolean)
    .slice(0, limit);
}

function cleanChoices(value, query) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const label = cleanString(item?.label, 60);
      const refinement = cleanString(item?.refinement || `${query}；${label}`, 320);
      return { label, refinement };
    })
    .filter((item) => item.label && item.refinement)
    .slice(0, 4);
}

function normaliseWorkflowScope(value) {
  let normalized = cleanString(value, 100)
    .toLowerCase()
    .replace(/[_\s\u2010-\u2015\u2212]+/gu, '-')
    .replace(/-+/g, '-');

  if (normalized === 'endtoend') normalized = 'end-to-end';
  return ['end-to-end', 'component', 'either', 'unknown'].includes(normalized)
    ? normalized
    : 'unknown';
}

function normaliseIntent(raw, query) {
  return {
    original_query: query,
    primary_goal: cleanString(raw?.primary_goal || query),
    desired_output: cleanString(raw?.desired_output),
    must_have: cleanList(raw?.must_have),
    preferences: cleanList(raw?.preferences),
    avoid: cleanList(raw?.avoid),
    platform: cleanList(raw?.platform, 6, 80),
    execution: cleanList(raw?.execution, 6, 80),
    budget: cleanString(raw?.budget, 80),
    openness: cleanString(raw?.openness, 80),
    interface: cleanList(raw?.interface, 6, 80),
    skill_level: cleanString(raw?.skill_level, 80),
    workflow_scope: normaliseWorkflowScope(raw?.workflow_scope),
    implied_needs: cleanList(raw?.implied_needs),
    search_concepts: cleanList(raw?.search_concepts, 12, 80),
    ambiguities: cleanList(raw?.ambiguities, 6, 120),
    needs_clarification: raw?.needs_clarification === true,
    clarifying_question: cleanString(raw?.clarifying_question, 180),
    clarification_choices: cleanChoices(raw?.clarification_choices, query)
  };
}

function buildIntentPrompt(query) {
  return [
    '你是需求分析器。只解析需求，不推薦工具。',
    '輸出精簡繁體中文 JSON；不要 Markdown、code fence 或額外文字。',
    '保留明確限制：本機/雲端、開源、預算、平台、API/CLI/Web/App 等，統一放入 must_have、preferences 或 avoid，不要另外展開欄位。',
    'must_have 最多 4 項；preferences 最多 3 項；avoid 最多 3 項；implied_needs 最多 3 項；search_concepts 最多 6 項。',
    'workflow_scope 只能是 end-to-end、component、either 或 unknown。',
    '只有缺少資訊會實質改變工具種類時 needs_clarification=true；否則 false。',
    'needs_clarification=true 時才輸出 clarifying_question 與 2-3 個 clarification_choices；refinement 必須保留原需求並只加入該澄清條件。',
    'JSON schema:',
    '{"primary_goal":"核心目標","desired_output":"最終產出","must_have":["必要條件"],"preferences":["偏好"],"avoid":["不要的條件"],"workflow_scope":"end-to-end/component/either/unknown","implied_needs":["合理隱含需求"],"search_concepts":["核心搜尋概念"],"needs_clarification":false,"clarifying_question":"僅需要時","clarification_choices":[{"label":"選項","refinement":"完整需求"}]}',
    `使用者原話：${query}`
  ].join('\n');
}

async function understandIntent(query, env) {
  const result = await env.AI.run(env.MODEL || DEFAULT_MODEL, {
    prompt: buildIntentPrompt(query),
    temperature: 0.05,
    reasoning_effort: AI_REASONING_EFFORT,
    max_completion_tokens: INTENT_MAX_COMPLETION_TOKENS
  }, AI_RUN_OPTIONS);
  return normaliseIntent(parseJsonObject(extractText(result)), query);
}

const FALLBACK_NEGATION = /(?:不要|不想|不需要|不用|避免|不希望|拒絕|排除)/u;
const FALLBACK_CONTRAST = /(?:但(?:是)?|不過|而是|只要|改用|改成|改為)/u;

function fallbackPositiveClause(clause) {
  let remaining = String(clause || '').trim();
  const positiveParts = [];

  while (remaining) {
    const negation = FALLBACK_NEGATION.exec(remaining);
    if (!negation) {
      positiveParts.push(remaining);
      break;
    }

    const prefix = remaining.slice(0, negation.index).trim();
    if (prefix) positiveParts.push(prefix);

    const negatedTail = remaining.slice(negation.index + negation[0].length);
    const contrast = FALLBACK_CONTRAST.exec(negatedTail);
    if (!contrast) break;

    remaining = negatedTail
      .slice(contrast.index + contrast[0].length)
      .trim();
  }

  return positiveParts.join(' ');
}

function fallbackPositiveText(query) {
  return String(query || '')
    .toLowerCase()
    .split(/[，,。.!！？?；;\n]+/u)
    .map(fallbackPositiveClause)
    .filter(Boolean)
    .join(' ');
}

function fallbackQueryConcepts(query) {
  const normalized = fallbackPositiveText(query);
  const concepts = new Set(
    normalized
      .split(/[^\p{L}\p{N}+#.-]+/u)
      .filter((term) => term.length >= 2 && !/\p{Script=Han}/u.test(term))
  );

  for (const run of normalized.match(/\p{Script=Han}{3,}/gu) || []) {
    for (const size of [4, 3]) {
      if (run.length < size) continue;
      for (let index = 0; index <= run.length - size; index += 1) {
        concepts.add(run.slice(index, index + size));
      }
    }
  }

  return [...concepts].slice(0, 48);
}

function fallbackIntent(query) {
  return normaliseIntent({
    primary_goal: query,
    desired_output: query,
    workflow_scope: 'unknown',
    search_concepts: fallbackQueryConcepts(query),
    needs_clarification: false
  }, query);
}

function hasUsableClarification(intent) {
  return intent?.needs_clarification === true
    && Boolean(intent.clarifying_question)
    && Array.isArray(intent.clarification_choices)
    && intent.clarification_choices.length >= 2;
}

function rankingConcepts(intent) {
  return [...new Set([
    ...fallbackQueryConcepts(intent.original_query),
    ...intent.search_concepts,
    ...intent.must_have,
    ...intent.preferences,
    ...intent.implied_needs,
    intent.primary_goal,
    intent.desired_output
  ]
    .map((value) => String(value || '').toLowerCase().trim())
    .filter((value) => value.length >= 2))];
}

function scoreResourcesForRanking(intent, resources) {
  const concepts = rankingConcepts(intent);

  return resources.map((resource) => {
    const strongHaystack = [
      resource.id,
      resource.name,
      ...(resource.tags || []),
      ...(resource.categories || [])
    ].join(' ').toLowerCase();

    const broadHaystack = [
      strongHaystack,
      resource.summary,
      resource.notes,
      ...(resource.use_cases || [])
    ].join(' ').toLowerCase();

    let score = 0;
    let matches = 0;
    for (const concept of concepts) {
      if (strongHaystack.includes(concept)) {
        score += concept.length >= 4 ? 8 : 4;
        matches += 1;
      } else if (broadHaystack.includes(concept)) {
        score += concept.length >= 4 ? 5 : 2;
        matches += 1;
      }
    }

    return { resource, score, matches };
  }).sort((a, b) =>
    b.score - a.score
    || b.matches - a.matches
    || String(a.resource.id).localeCompare(String(b.resource.id))
  );
}

function prefilterResources(intent, resources) {
  if (resources.length <= RANKING_CANDIDATE_LIMIT) return resources;

  const scored = scoreResourcesForRanking(intent, resources);
  const positive = scored.filter((item) => item.score > 0);
  if (!positive.length) return resources;

  const seedCategories = new Set(
    positive
      .slice(0, 4)
      .flatMap((item) => item.resource.categories || [])
  );

  const selected = [];
  const selectedIds = new Set();

  for (const item of positive) {
    if (selected.length >= RANKING_CANDIDATE_LIMIT) break;
    selected.push(item.resource);
    selectedIds.add(item.resource.id);
  }

  const categoryPeers = resources
    .filter((resource) => !selectedIds.has(resource.id))
    .map((resource) => ({
      resource,
      overlap: (resource.categories || []).filter((category) => seedCategories.has(category)).length
    }))
    .filter((item) => item.overlap > 0)
    .sort((a, b) =>
      b.overlap - a.overlap
      || Number(b.resource.rating || 0) - Number(a.resource.rating || 0)
      || String(a.resource.id).localeCompare(String(b.resource.id))
    );

  for (const item of categoryPeers) {
    if (selected.length >= RANKING_CANDIDATE_LIMIT) break;
    selected.push(item.resource);
    selectedIds.add(item.resource.id);
  }

  if (selected.length < RANKING_MIN_CANDIDATES) return resources;
  return selected.slice(0, RANKING_CANDIDATE_LIMIT);
}

function buildRankingPrompt(intent, resources) {
  const catalog = resources.map(compactResource);
  return [
    '你是 Qookey AI Resource Hub 的高精準資源審查員。',
    '你收到的是「已解析的使用者需求」與 deterministic prefilter 篩出的候選 catalog。',
    '請先逐一判斷資源是否符合需求，再推薦；不要用關鍵字看到像就推薦。',
    '最高優先順序：must_have > avoid > desired_output > workflow_scope > preferences > implied_needs。',
    '若某資源違反 must_have 或命中 avoid，除非需求明確允許替代，否則不能推薦。',
    '如果使用者要 end-to-end 完成，優先推薦能直接完成主要產出的工具；泛用 UI、雲端、資料庫、開發工具不可拿來湊數。',
    '如果使用者要 component，則可推薦專門零件。',
    '不要因為 rating 高、Star 多、熱門或免費就推薦不相關資源。',
    '不要湊數。推薦 1 到 4 個即可；真正只有 1 個符合就只推薦 1 個。',
    '如果沒有符合需求的資源，recommendations 必須是空陣列，no_match=true。',
    '每個推薦都要給 fit_score 0-100；低於 72 分的不要推薦。',
    'reason 必須明確對應使用者要求，例如「符合本機、開源、API」；不要只重述資源介紹。',
    'constraint_match 必須列出它符合哪些明確要求。constraint_miss 則列出仍不符合或未知的要求。',
    '只能使用候選 catalog 裡真的存在的 id 與資訊，不得幻想功能。',
    '輸出單一 JSON object，不要 Markdown、不要 code fence、不要額外文字。',
    'JSON schema:',
    '{"intent_summary":"你對需求的簡短理解","no_match":false,"recommendations":[{"id":"catalog id","fit_score":0,"role":"在此任務中的角色","constraint_match":["符合的要求"],"constraint_miss":["未符合或未知"],"reason":"為什麼真的適合","how_to_use":"此任務中怎麼用"}],"missing_capability":"若 no_match=true，說目前資源庫缺什麼；否則空字串"}',
    '',
    `需求規格：${JSON.stringify(intent)}`,
    '',
    `catalog：${JSON.stringify(catalog)}`
  ].join('\n');
}

function validateRecommendations(output, resources) {
  const known = new Map(resources.map((resource) => [resource.id, resource]));
  const recommendations = Array.isArray(output?.recommendations)
    ? output.recommendations
        .filter((item) => item && known.has(item.id))
        .map((item) => ({
          id: item.id,
          fit_score: Math.max(0, Math.min(100, Number(item.fit_score || 0))),
          role: cleanString(item.role, 50),
          constraint_match: cleanList(item.constraint_match, 8, 100),
          constraint_miss: cleanList(item.constraint_miss, 8, 100),
          reason: cleanString(item.reason, 260),
          how_to_use: cleanString(item.how_to_use, 240)
        }))
        .filter((item) => item.fit_score >= 72)
        .sort((a, b) => b.fit_score - a.fit_score)
        .slice(0, 4)
    : [];

  return {
    intent_summary: cleanString(output?.intent_summary, 240),
    no_match: output?.no_match === true || recommendations.length === 0,
    recommendations,
    missing_capability: cleanString(output?.missing_capability, 240)
  };
}

async function rankResources(intent, resources, env) {
  const result = await env.AI.run(env.MODEL || DEFAULT_MODEL, {
    prompt: buildRankingPrompt(intent, resources),
    temperature: 0.05,
    reasoning_effort: AI_REASONING_EFFORT,
    max_completion_tokens: 900
  }, AI_RUN_OPTIONS);
  return validateRecommendations(parseJsonObject(extractText(result)), resources);
}

function fallbackRecommendations(intent, resources) {
  const concepts = [...new Set([
    ...fallbackQueryConcepts(intent.original_query),
    ...intent.search_concepts,
    ...intent.must_have,
    ...intent.preferences,
    intent.primary_goal,
    intent.desired_output
  ]
    .map((value) => String(value || '').toLowerCase().trim())
    .filter((value) => value.length >= 2))];

  const scored = resources.map((resource) => {
    const haystack = [
      resource.name,
      resource.summary,
      resource.notes,
      ...(resource.categories || []),
      ...(resource.tags || []),
      ...(resource.use_cases || [])
    ].join(' ').toLowerCase();

    let score = 0;
    let matches = 0;
    for (const concept of concepts) {
      if (!haystack.includes(concept)) continue;
      score += concept.length >= 4 ? 5 : 2;
      matches += 1;
    }
    return { resource, score, matches };
  }).sort((a, b) => b.score - a.score || b.matches - a.matches);

  const eligible = scored.filter((item) => item.score >= 5 || (item.score >= 4 && item.matches >= 2));
  if (!eligible.length) return [];
  const floor = Math.max(4, eligible[0].score * 0.6);

  return eligible
    .filter((item) => item.score >= floor)
    .slice(0, 3)
    .map(({ resource, score }) => ({
      id: resource.id,
      fit_score: Math.min(79, 60 + score),
      role: '備援候選',
      constraint_match: [],
      constraint_miss: ['AI 精準審查暫時無法完成'],
      reason: resource.summary || '與需求中的核心概念有直接文字關聯。',
      how_to_use: resource.use_cases?.[0] || '先查看資源說明與限制。'
    }));
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
      return json({
        ok: true,
        service: 'qookey-ai-resource-recommender',
        version: RECOMMENDER_VERSION,
        model: env.MODEL || DEFAULT_MODEL
      }, 200, cors);
    }

    if (request.method !== 'POST' || url.pathname !== '/api/recommend') {
      return json({ error: 'not_found' }, 404, cors);
    }

    if (!cors['access-control-allow-origin']) {
      return json({ error: 'origin_not_allowed' }, 403, cors);
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

    const requestStarted = Date.now();
    let catalogMs = 0;
    let intentMs = 0;
    let rankingMs = 0;
    let intentDiagnostic = '';
    let intentQuotaExhausted = false;

    let resources;
    const catalogStarted = Date.now();
    try {
      resources = await loadCatalog(env);
    } catch (error) {
      catalogMs = Date.now() - catalogStarted;
      return json({
        error: 'catalog_unavailable',
        message: String(error.message || error),
        timings_ms: timingSnapshot(requestStarted, catalogMs, intentMs, rankingMs)
      }, 503, cors);
    }
    catalogMs = Date.now() - catalogStarted;

    if (!resources.length) {
      return json({ error: 'catalog_empty' }, 503, cors);
    }

    let intent;
    let intentMode = 'ai';
    const intentStarted = Date.now();
    try {
      intent = await understandIntent(query, env);
    } catch (error) {
      console.error('intent understanding failed', error);
      intentDiagnostic = cleanString(error?.message || error, 180);
      intentQuotaExhausted = isProviderQuotaExhausted(error);
      intent = fallbackIntent(query);
      intentMode = 'fallback';
    } finally {
      intentMs = Date.now() - intentStarted;
    }

    if (intentMode === 'ai' && hasUsableClarification(intent)) {
      return json({
        ok: true,
        mode: 'clarify',
        version: RECOMMENDER_VERSION,
        query,
        intent_mode: intentMode,
        intent,
        intent_diagnostic: intentDiagnostic,
        timings_ms: timingSnapshot(requestStarted, catalogMs, intentMs, rankingMs),
        clarifying_question: intent.clarifying_question,
        choices: intent.clarification_choices,
        recommendations: []
      }, 200, cors);
    }

    if (intentQuotaExhausted) {
      const recommendations = fallbackRecommendations(intent, resources);
      return json({
        ok: true,
        mode: recommendations.length ? 'fallback' : 'no_match',
        version: RECOMMENDER_VERSION,
        query,
        intent_mode: intentMode,
        intent,
        intent_diagnostic: intentDiagnostic,
        timings_ms: timingSnapshot(requestStarted, catalogMs, intentMs, rankingMs),
        catalog_count: resources.length,
        ranking_candidate_count: 0,
        ranking_skipped: true,
        intent_summary: intent.primary_goal,
        no_match: recommendations.length === 0,
        recommendations,
        missing_capability: recommendations.length ? '' : '目前資源庫沒有足夠直接的候選資源。',
        diagnostic: 'provider_quota_exhausted'
      }, 200, cors);
    }

    const rankingCandidates = prefilterResources(intent, resources);
    const rankingStarted = Date.now();
    try {
      const ranked = await rankResources(intent, rankingCandidates, env);
      rankingMs = Date.now() - rankingStarted;
      if (ranked.no_match && intentMode === 'fallback') {
        const recommendations = fallbackRecommendations(intent, resources);
        if (recommendations.length) {
          return json({
            ok: true,
            mode: 'fallback',
            version: RECOMMENDER_VERSION,
            query,
            intent_mode: intentMode,
            intent,
            intent_diagnostic: intentDiagnostic,
            timings_ms: timingSnapshot(requestStarted, catalogMs, intentMs, rankingMs),
            catalog_count: resources.length,
            ranking_candidate_count: rankingCandidates.length,
            intent_summary: ranked.intent_summary || intent.primary_goal,
            no_match: false,
            recommendations,
            missing_capability: '',
            diagnostic: 'intent_fallback_no_match_recovered'
          }, 200, cors);
        }
      }

      return json({
        ok: true,
        mode: ranked.no_match ? 'no_match' : 'ai',
        version: RECOMMENDER_VERSION,
        query,
        intent_mode: intentMode,
        intent,
        intent_diagnostic: intentDiagnostic,
        timings_ms: timingSnapshot(requestStarted, catalogMs, intentMs, rankingMs),
        catalog_count: resources.length,
        ranking_candidate_count: rankingCandidates.length,
        ...ranked
      }, 200, cors);
    } catch (error) {
      rankingMs = Date.now() - rankingStarted;
      console.error('resource ranking failed', error);
      const recommendations = fallbackRecommendations(intent, resources);
      return json({
        ok: true,
        mode: recommendations.length ? 'fallback' : 'no_match',
        version: RECOMMENDER_VERSION,
        query,
        intent_mode: intentMode,
        intent,
        intent_diagnostic: intentDiagnostic,
        timings_ms: timingSnapshot(requestStarted, catalogMs, intentMs, rankingMs),
        catalog_count: resources.length,
        ranking_candidate_count: rankingCandidates.length,
        intent_summary: intent.primary_goal,
        no_match: recommendations.length === 0,
        recommendations,
        missing_capability: recommendations.length ? '' : '目前資源庫沒有足夠直接的候選資源。',
        diagnostic: cleanString(error?.message || error, 180)
      }, 200, cors);
    }
  }
};