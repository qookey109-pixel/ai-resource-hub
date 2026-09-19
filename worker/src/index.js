const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/qookey109-pixel/ai-resource-hub/main/data/resources.json';
const DEFAULT_MODEL = '@cf/zai-org/glm-4.7-flash';
const SITE_ORIGIN = 'https://qookey109-pixel.github.io';
const RECOMMENDER_VERSION = '0.3.11';
const AI_RUN_OPTIONS = Object.freeze({ rejectIfBusy: true });
const AI_REASONING_EFFORT = 'low';
const INTENT_MAX_COMPLETION_TOKENS = 480;
const RANKING_MAX_COMPLETION_TOKENS = 420;
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

function compactRankingResource(resource) {
  return {
    id: resource.id,
    name: resource.name,
    categories: resource.categories || [],
    tags: resource.tags || [],
    summary: resource.summary || '',
    use_cases: (resource.use_cases || []).slice(0, 3),
    pricing: resource.pricing || 'unknown',
    open_source: resource.open_source ?? null,
    difficulty: resource.difficulty || 'unknown',
    rating: resource.rating ?? null
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

const CONSTRAINT_SIGNAL_GROUPS = Object.freeze([
  ['local', ['本機', '本地', '離線', 'local', 'offline', 'on-device', 'on device']],
  ['cloud', ['雲端', 'cloud']],
  ['open-source', ['開源', 'open source', 'open-source']],
  ['free', ['免費', 'free', '零成本', '0元', '0 元', '預算0', '預算 0', 'budget 0']],
  ['paid', ['付費', '收費', 'paid']],
  ['windows', ['windows']],
  ['macos', ['macos', 'mac os']],
  ['linux', ['linux']],
  ['api', ['api']],
  ['cli', ['cli', '命令列', 'command line']],
  ['web-ui', ['web ui', 'web介面', '網頁介面', '瀏覽器介面']],
  ['app', ['app', '應用程式']],
  ['subscription', ['訂閱', 'subscription']],
  ['single-tool', ['一套工具', '單一工具', '一個工具', '直接完成', '端到端', 'end-to-end', 'end to end', '無需額外', '不需額外', '不用額外']],
  ['automatic', ['自動', '自動化', 'automation', 'automated']]
]);

const CONSTRAINT_LEXICAL_STOP = new Set([
  '需要', '必須', '支援', '使用', '透過', '避免', '希望', '不要', '不需', '無需',
  '可以', '軟體', '工具', '服務', '操作', '執行', '功能', '方案'
]);

function normaliseGroundingText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[＿_–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function signalGroupsFor(value) {
  const text = normaliseGroundingText(value);
  return CONSTRAINT_SIGNAL_GROUPS
    .filter(([, terms]) => terms.some((term) => text.includes(normaliseGroundingText(term))))
    .map(([name]) => name);
}

function querySupportsSignalGroup(query, groupName) {
  const text = normaliseGroundingText(query);
  const group = CONSTRAINT_SIGNAL_GROUPS.find(([name]) => name === groupName);
  return Boolean(group && group[1].some((term) => text.includes(normaliseGroundingText(term))));
}

function lexicalConstraintGrounded(value, query) {
  const item = normaliseGroundingText(value);
  const source = normaliseGroundingText(query);
  if (!item || !source) return false;

  const latinTokens = item.match(/[a-z][a-z0-9.+#-]{1,}/g) || [];
  if (latinTokens.some((token) => source.includes(token))) return true;

  for (const run of item.match(/\p{Script=Han}{2,}/gu) || []) {
    if (source.includes(run)) return true;
    for (const size of [4, 3, 2]) {
      if (run.length < size) continue;
      for (let index = 0; index <= run.length - size; index += 1) {
        const chunk = run.slice(index, index + size);
        if (CONSTRAINT_LEXICAL_STOP.has(chunk)) continue;
        if (source.includes(chunk)) return true;
      }
    }
  }
  return false;
}

function isGroundedConstraint(value, query) {
  const groups = signalGroupsFor(value);
  if (groups.length) {
    return groups.every((group) => querySupportsSignalGroup(query, group));
  }
  return lexicalConstraintGrounded(value, query);
}

function groundConstraintList(value, query, limit = 8, itemMax = 120) {
  return cleanList(value, limit, itemMax).filter((item) => isGroundedConstraint(item, query));
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
    must_have: groundConstraintList(raw?.must_have, query),
    preferences: groundConstraintList(raw?.preferences, query),
    avoid: groundConstraintList(raw?.avoid, query),
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
    'must_have、preferences、avoid 只能放使用者原話明確表達或直接同義的限制；未提到就留空。',
    '不得自行補本機/雲端、開源/免費、預算、作業系統、API/CLI/Web/App、訂閱等限制。合理推論只能放 implied_needs，不得升格成硬限制。',
    '每個限制只寫一件事，不要把已知條件與推測條件合併在同一項。',
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
  const decisionIntent = {
    original_query: intent.original_query,
    primary_goal: intent.primary_goal,
    desired_output: intent.desired_output,
    must_have: intent.must_have,
    preferences: intent.preferences,
    avoid: intent.avoid,
    workflow_scope: intent.workflow_scope,
    implied_needs: intent.implied_needs,
    search_concepts: intent.search_concepts
  };
  const catalog = resources.map(compactRankingResource);
  return [
    '你是 Qookey AI Resource Hub 的高精準資源審查員。',
    '候選已經過 deterministic prefilter；請只做最後相關性判斷，不要重新摘要 catalog。',
    '優先順序：must_have > avoid > desired_output > workflow_scope > preferences > implied_needs。',
    '違反 must_have 或命中 avoid 的資源不可推薦；不要因為熱門、免費或 rating 高而湊數。',
    '最多推薦 3 個；fit_score 低於 72 不得推薦。',
    '如果沒有符合需求的資源，recommendations 必須是空陣列且 no_match=true。',
    'reason 只寫一句繁體中文、直接說明它如何符合需求，避免重複資源介紹。',
    '只能使用候選 catalog 內存在的 id，不得幻想功能。',
    '輸出單一 JSON object，不要 Markdown、code fence 或額外文字。',
    'JSON schema:',
    '{"no_match":false,"recommendations":[{"id":"catalog id","fit_score":0,"reason":"一句原因"}]}',
    `需求規格：${JSON.stringify(decisionIntent)}`,
    `catalog：${JSON.stringify(catalog)}`
  ].join('\n');
}
function validateRecommendations(output, resources, intent) {
  const known = new Map(resources.map((resource) => [resource.id, resource]));
  const recommendations = Array.isArray(output?.recommendations)
    ? output.recommendations
        .filter((item) => item && known.has(item.id))
        .map((item) => {
          const resource = known.get(item.id);
          return {
            id: item.id,
            fit_score: Math.max(0, Math.min(100, Number(item.fit_score || 0))),
            role: '推薦候選',
            constraint_match: [],
            constraint_miss: [],
            reason: cleanString(item.reason, 180) || cleanString(resource.summary, 180),
            how_to_use: cleanString(resource.use_cases?.[0], 240)
          };
        })
        .filter((item) => item.fit_score >= 72)
        .sort((a, b) => b.fit_score - a.fit_score)
        .slice(0, 3)
    : [];

  return {
    intent_summary: cleanString(intent?.primary_goal || intent?.original_query, 240),
    no_match: recommendations.length === 0,
    recommendations,
    missing_capability: recommendations.length ? '' : '目前候選資源不足以直接符合需求。'
  };
}
async function rankResources(intent, resources, env) {
  const result = await env.AI.run(env.MODEL || DEFAULT_MODEL, {
    prompt: buildRankingPrompt(intent, resources),
    temperature: 0.05,
    reasoning_effort: AI_REASONING_EFFORT,
    max_completion_tokens: RANKING_MAX_COMPLETION_TOKENS
  }, AI_RUN_OPTIONS);
  return validateRecommendations(parseJsonObject(extractText(result)), resources, intent);
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
      if (ranked.no_match) {
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
            diagnostic: intentMode === 'fallback' ? 'intent_fallback_no_match_recovered' : 'ai_no_match_recovered'
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