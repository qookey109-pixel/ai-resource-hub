const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/qookey109-pixel/ai-resource-hub/main/data/resources.json';
const DEFAULT_MODEL = '@cf/zai-org/glm-4.7-flash';
const SITE_ORIGIN = 'https://qookey109-pixel.github.io';
const RECOMMENDER_VERSION = '0.3.2';

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
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('model did not return JSON');
  }
}

function cleanString(value, max = 240) {
  return String(value || '').trim().slice(0, max);
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
    workflow_scope: cleanString(raw?.workflow_scope, 100),
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
    '你是需求分析器。你的工作不是推薦工具，而是先精準理解使用者真正要完成的事情。',
    '請把自然語言需求拆成結構化規格。不要自行增加使用者沒有說過的硬性條件。',
    '可以推論合理的 implied_needs，但必須和明確要求分開。',
    '特別注意否定詞、偏好詞、價格限制、本機/雲端、開源/閉源、平台、API/CLI/Web/App、技術程度與是否要求端到端完成。',
    'workflow_scope 只能填 end-to-end、component、either 或 unknown。',
    '如果使用者只是說「我要做 X」，desired_output 應該描述最終產出，而不是某個工具名稱。',
    '只有當缺少的資訊會「實質改變要推薦的工具種類或核心能力」時，needs_clarification 才能設為 true。',
    '不要為了次要偏好而追問。沒有指定預算、開源與否、部署方式或技術程度，通常不需要先問。',
    '如果需求本身已明確指出工作類型，例如「AI 短影片」「Three.js 3D 遊戲效果」「LINE AI 客服」，即使實作細節尚未指定，也應 needs_clarification=false，先做合理推薦。',
    '如果需求過度寬泛而存在明顯不同方向，例如只說「做客服」「做網站」「做 AI 工具」，而不同方向會用到完全不同資源，才應先問一個澄清問題。',
    'needs_clarification=true 時，clarifying_question 只問一個最關鍵問題；clarification_choices 提供 2 到 4 個互斥且實用的選項。',
    '每個 clarification_choices.refinement 必須保留使用者原本要求，並只加入該選項代表的澄清內容，形成可直接再次送入分析器的完整需求。',
    'needs_clarification=false 時，clarifying_question 必須是空字串，clarification_choices 必須是空陣列。',
    '輸出繁體中文 JSON，不要 Markdown、不要 code fence、不要額外文字。',
    'JSON schema:',
    '{"primary_goal":"核心目標","desired_output":"最後要得到什麼","must_have":["明確必須條件"],"preferences":["偏好但非必要"],"avoid":["明確不要"],"platform":["macOS/web/mobile/Windows/不限等"],"execution":["local/cloud/self-hosted/不限等"],"budget":"免費/低成本/可付費/未指定","openness":"開源優先/必須開源/不限/未指定","interface":["API/CLI/WebUI/App/MCP 等"],"skill_level":"beginner/intermediate/advanced/未指定","workflow_scope":"end-to-end/component/either/unknown","implied_needs":["合理隱含需求"],"search_concepts":["用來找工具的核心概念，不要放停用詞"],"ambiguities":["真的會影響推薦但使用者沒說清楚的地方"],"needs_clarification":false,"clarifying_question":"","clarification_choices":[{"label":"選項名稱","refinement":"保留原要求後加入此選項的完整需求"}]}',
    '',
    `使用者原話：${query}`
  ].join('\n');
}

async function understandIntent(query, env) {
  const result = await env.AI.run(env.MODEL || DEFAULT_MODEL, {
    prompt: buildIntentPrompt(query),
    temperature: 0.05,
    max_tokens: 900
  });
  return normaliseIntent(parseJsonObject(extractText(result)), query);
}

const FALLBACK_QUERY_STOPWORDS = new Set([
  '我要', '我想', '我想要', '想要', '請', '請幫我', '幫我', '需要', '希望', '最好', '最好是',
  '在', '從', '用', '做', '找', '可以', '能夠', '拿去', '的', '和', '與', '或', '以及', '並且',
  '並', '而且', '一個', '一套', '工具', '服務', '直接', '完成'
]);
const FALLBACK_NEGATION = /(?:不要|不想|不需要|不用|避免|不希望|拒絕|排除)/u;

function fallbackSearchConcepts(query) {
  const positiveText = String(query)
    .toLowerCase()
    .split(/[，,。.!！？?；;\n]+/u)
    .map((clause) => clause.split(FALLBACK_NEGATION, 1)[0].trim())
    .filter(Boolean)
    .join(' ');

  let words;
  if (typeof Intl === 'object' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
    words = [...segmenter.segment(positiveText)]
      .filter((part) => part.isWordLike)
      .map((part) => part.segment);
  } else {
    words = positiveText.split(/[^\p{L}\p{N}+#.-]+/u);
  }

  return [...new Set(words
    .map((term) => String(term || '').toLowerCase().trim())
    .filter((term) => term.length >= 2 && !FALLBACK_QUERY_STOPWORDS.has(term)))]
    .slice(0, 12);
}

function fallbackIntent(query) {
  return normaliseIntent({
    primary_goal: query,
    desired_output: query,
    workflow_scope: 'unknown',
    search_concepts: fallbackSearchConcepts(query),
    needs_clarification: false
  }, query);
}

function hasUsableClarification(intent) {
  return intent?.needs_clarification === true
    && Boolean(intent.clarifying_question)
    && Array.isArray(intent.clarification_choices)
    && intent.clarification_choices.length >= 2;
}

function buildRankingPrompt(intent, resources) {
  const catalog = resources.map(compactResource);
  return [
    '你是 Qookey AI Resource Hub 的高精準資源審查員。',
    '你收到的是「已解析的使用者需求」與完整 catalog。',
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
    '只能使用 catalog 裡真的存在的 id 與資訊，不得幻想功能。',
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
    max_tokens: 1200
  });
  return validateRecommendations(parseJsonObject(extractText(result)), resources);
}

function fallbackRecommendations(intent, resources) {
  const concepts = [...new Set([
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

    let resources;
    try {
      resources = await loadCatalog(env);
    } catch (error) {
      return json({ error: 'catalog_unavailable', message: String(error.message || error) }, 503, cors);
    }

    if (!resources.length) {
      return json({ error: 'catalog_empty' }, 503, cors);
    }

    let intent;
    let intentMode = 'ai';
    try {
      intent = await understandIntent(query, env);
    } catch (error) {
      console.error('intent understanding failed', error);
      intent = fallbackIntent(query);
      intentMode = 'fallback';
    }

    if (intentMode === 'ai' && hasUsableClarification(intent)) {
      return json({
        ok: true,
        mode: 'clarify',
        version: RECOMMENDER_VERSION,
        query,
        intent_mode: intentMode,
        intent,
        clarifying_question: intent.clarifying_question,
        choices: intent.clarification_choices,
        recommendations: []
      }, 200, cors);
    }

    try {
      const ranked = await rankResources(intent, resources, env);
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
        ...ranked
      }, 200, cors);
    } catch (error) {
      console.error('resource ranking failed', error);
      const recommendations = fallbackRecommendations(intent, resources);
      return json({
        ok: true,
        mode: recommendations.length ? 'fallback' : 'no_match',
        version: RECOMMENDER_VERSION,
        query,
        intent_mode: intentMode,
        intent,
        intent_summary: intent.primary_goal,
        no_match: recommendations.length === 0,
        recommendations,
        missing_capability: recommendations.length ? '' : '目前資源庫沒有足夠直接的候選資源。',
        diagnostic: cleanString(error?.message || error, 180)
      }, 200, cors);
    }
  }
};