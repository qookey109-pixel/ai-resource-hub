#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workerPath = 'worker/src/index.js';
const catalogPath = 'data/resources.json';

let source = fs.readFileSync(workerPath, 'utf8');
assert.match(
  source,
  /if \(ranked\.no_match\) \{[\s\S]*fallbackRecommendations\(intent, resources\)[\s\S]*ai_no_match_recovered/,
  'Any AI no-match must be cross-checked against deterministic full-catalog recovery.'
);

assert.match(
  source,
  /const AI_RUN_OPTIONS = Object\.freeze\(\{ rejectIfBusy: true \}\);/,
  'Worker must reject busy Workers AI capacity instead of waiting in the queue.'
);
assert.equal(
  (source.match(/AI_RUN_OPTIONS\);/g) || []).length,
  2,
  'Both Workers AI inference stages must use the fail-fast capacity option.'
);

assert.equal(
  (source.match(/reasoning_effort: AI_REASONING_EFFORT/g) || []).length,
  2,
  'Both Workers AI stages must use the bounded low reasoning effort setting.'
);
assert.equal(
  (source.match(/max_completion_tokens:/g) || []).length,
  2,
  'Both Workers AI stages must use max_completion_tokens.'
);
assert.doesNotMatch(
  source,
  /\bmax_tokens\s*:/,
  'Deprecated max_tokens must not return to the Worker inference path.'
);

source = source.replace(
  'export default {',
  'globalThis.__test = { parseJsonObject, normaliseWorkflowScope, normaliseIntent, buildIntentPrompt, buildRankingPrompt, validateRecommendations, compactRankingResource, isGroundedConstraint, groundConstraintList, isProviderQuotaExhausted, fallbackQueryConcepts, fallbackIntent, fallbackRecommendations, prefilterResources }; globalThis.__worker = {'
);

const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')).resources;
assert.ok(Array.isArray(catalog) && catalog.length > 0, 'catalog must contain resources');

const {
  parseJsonObject,
  normaliseWorkflowScope,
  normaliseIntent,
  buildIntentPrompt,
  buildRankingPrompt,
  validateRecommendations,
  compactRankingResource,
  isGroundedConstraint,
  groundConstraintList,
  isProviderQuotaExhausted,
  fallbackQueryConcepts,
  fallbackIntent,
  fallbackRecommendations,
  prefilterResources
} = context.__test;

assert.deepEqual(
  JSON.parse(JSON.stringify(parseJsonObject('{"ok":true,"nested":{"text":"brace } inside string"}}\ntrailing model text'))),
  { ok: true, nested: { text: 'brace } inside string' } },
  'parser must accept the first complete JSON object and ignore trailing model text'
);
assert.equal(normaliseWorkflowScope('end-to end'), 'end-to-end');
assert.equal(normaliseWorkflowScope('end to end'), 'end-to-end');
assert.equal(normaliseWorkflowScope('end_to_end'), 'end-to-end');
assert.equal(normaliseWorkflowScope('unexpected-value'), 'unknown');

const intentPrompt = buildIntentPrompt('我要在本機做語音複製和配音，不想依賴雲端訂閱服務');
assert.ok(
  intentPrompt.length < 1800,
  `intent prompt must stay compact; got ${intentPrompt.length} characters`
);
for (const legacyKey of ['"platform":', '"execution":', '"budget":', '"openness":', '"interface":', '"skill_level":', '"ambiguities":']) {
  assert.equal(
    intentPrompt.includes(legacyKey),
    false,
    `compact intent schema must not request legacy field ${legacyKey}`
  );
}
assert.match(
  source,
  /const INTENT_MAX_COMPLETION_TOKENS = 480;/,
  'Intent completion budget must stay bounded at 480 tokens.'
);
assert.match(
  source,
  /max_completion_tokens: INTENT_MAX_COMPLETION_TOKENS/,
  'Intent inference must use the bounded intent completion budget.'
);
assert.match(
  source,
  /const RANKING_MAX_COMPLETION_TOKENS = 420;/,
  'Ranking completion budget must stay bounded at 420 tokens.'
);
assert.match(
  source,
  /max_completion_tokens: RANKING_MAX_COMPLETION_TOKENS/,
  'Ranking inference must use the bounded ranking completion budget.'
);

assert.equal(
  isProviderQuotaExhausted(new Error('4006: you have used up your daily free allocation of 10,000 neurons')),
  true,
  'Cloudflare Workers AI daily neuron exhaustion must be classified as provider quota exhaustion.'
);
assert.equal(
  isProviderQuotaExhausted(new Error('temporary model JSON parse failure')),
  false,
  'Normal model failures must not be misclassified as quota exhaustion.'
);
assert.match(
  source,
  /if \(intentQuotaExhausted\) \{[\s\S]*ranking_skipped: true[\s\S]*diagnostic: 'provider_quota_exhausted'/,
  'Quota exhaustion must short-circuit into deterministic fallback before ranking.'
);

const compactIntent = normaliseIntent({
  primary_goal: '在本機做語音複製與配音',
  desired_output: '本機語音工作站',
  must_have: ['本機執行', '語音複製'],
  avoid: ['雲端訂閱服務'],
  workflow_scope: 'end-to-end',
  search_concepts: ['本機語音', 'voice cloning'],
  needs_clarification: false
}, '我要在本機做語音複製和配音，不想依賴雲端訂閱服務');
assert.deepEqual(
  JSON.parse(JSON.stringify({
    must_have: compactIntent.must_have,
    avoid: compactIntent.avoid,
    workflow_scope: compactIntent.workflow_scope,
    platform: compactIntent.platform,
    execution: compactIntent.execution,
    budget: compactIntent.budget,
    interface: compactIntent.interface
  })),
  {
    must_have: ['本機執行', '語音複製'],
    avoid: ['雲端訂閱服務'],
    workflow_scope: 'end-to-end',
    platform: [],
    execution: [],
    budget: '',
    interface: []
  },
  'Compact model output must preserve legacy normalized API fields with safe empty defaults.'
);

assert.equal(isGroundedConstraint('本機執行', '我要在本機做語音複製和配音，不想依賴雲端訂閱服務'), true);
assert.equal(isGroundedConstraint('開源軟體', '我要在本機做語音複製和配音，不想依賴雲端訂閱服務'), false);
assert.equal(isGroundedConstraint('支援 Windows', '我要在本機做語音複製和配音，不想依賴雲端訂閱服務'), false);
assert.equal(isGroundedConstraint('依賴雲端訂閱服務', '我要在本機做語音複製和配音，不想依賴雲端訂閱服務'), true);
assert.equal(isGroundedConstraint('避免付費訂閱', '我要在本機做語音複製和配音，不想依賴雲端訂閱服務'), false);
assert.equal(isGroundedConstraint('單一工具解決', '我要自動產生 YouTube Shorts 短影片，最好是一套工具直接完成'), true);
assert.equal(isGroundedConstraint('支援繁體中文', '我只要支援繁體中文的工具'), true);

const hallucinated3dIntent = normaliseIntent({
  primary_goal: '從文字快速生成 3D 模型以用於遊戲原型',
  desired_output: '可用的 3D 模型資產',
  must_have: ['本機運算', '開源免費', '預算 0', '無付費方案'],
  preferences: ['API/CLI/Web/App 都可以'],
  avoid: ['雲端運算'],
  workflow_scope: 'component',
  implied_needs: ['支援文字轉 3D', '適合遊戲開發'],
  search_concepts: ['text to 3d', 'game asset'],
  needs_clarification: false
}, '我要從文字快速生成可以拿去做遊戲原型的 3D 模型');
assert.deepEqual(JSON.parse(JSON.stringify(hallucinated3dIntent.must_have)), []);
assert.deepEqual(JSON.parse(JSON.stringify(hallucinated3dIntent.preferences)), []);
assert.deepEqual(JSON.parse(JSON.stringify(hallucinated3dIntent.avoid)), []);

const hallucinatedVoiceIntent = normaliseIntent({
  primary_goal: '在本機執行語音複製與配音任務',
  desired_output: '本機執行的語音工作站',
  must_have: ['本機執行', '開源軟體', '支援 Windows', '透過 API 或 CLI 操作'],
  preferences: ['避免 Web UI', '避免付費訂閱'],
  avoid: ['依賴雲端訂閱服務'],
  workflow_scope: 'component',
  implied_needs: ['需要處理語音檔案'],
  search_concepts: ['語音複製', '配音'],
  needs_clarification: false
}, '我要在本機做語音複製和配音，不想依賴雲端訂閱服務');
assert.deepEqual(JSON.parse(JSON.stringify(hallucinatedVoiceIntent.must_have)), ['本機執行']);
assert.deepEqual(JSON.parse(JSON.stringify(hallucinatedVoiceIntent.preferences)), []);
assert.deepEqual(JSON.parse(JSON.stringify(hallucinatedVoiceIntent.avoid)), ['依賴雲端訂閱服務']);

const groundedShortsIntent = normaliseIntent({
  primary_goal: '自動產生 YouTube Shorts 短影片',
  desired_output: '一套工具直接完成',
  must_have: ['自動化產生', '單一工具解決', '無需額外處理'],
  preferences: ['YouTube Shorts 格式'],
  avoid: ['複雜流程'],
  workflow_scope: 'end-to-end',
  needs_clarification: false
}, '我要自動產生 YouTube Shorts 短影片，最好是一套工具直接完成');
assert.deepEqual(
  JSON.parse(JSON.stringify(groundedShortsIntent.must_have)),
  ['自動化產生', '單一工具解決', '無需額外處理']
);



const prefilterFixtures = [
  {
    query: '我要自動產生 YouTube Shorts 短影片，最好是一套工具直接完成',
    expected: 'money-printer-turbo'
  },
  {
    query: '我要在本機做語音複製和配音，不想依賴雲端訂閱服務',
    expected: 'voice-studio'
  },
  {
    query: '我要從文字快速生成可以拿去做遊戲原型的 3D 模型',
    expected: 'meshy-ai'
  }
];

for (const fixture of prefilterFixtures) {
  const candidates = prefilterResources(fallbackIntent(fixture.query), catalog);
  assert.ok(
    candidates.some((item) => item.id === fixture.expected),
    `prefilter must preserve ${fixture.expected}: ${JSON.stringify(candidates.map((item) => item.id))}`
  );
  assert.ok(
    candidates.length >= 8 && candidates.length <= 18,
    `prefilter should bound candidate count to 8-18 for fixture ${fixture.expected}, got ${candidates.length}`
  );
}

const rankingIntent = fallbackIntent('我要從文字快速生成可以拿去做遊戲原型的 3D 模型');
const rankingCandidates = prefilterResources(rankingIntent, catalog);
const rankingPrompt = buildRankingPrompt(rankingIntent, rankingCandidates);
assert.ok(
  rankingPrompt.length < 17000,
  `ranking prompt must stay compact for the 18-candidate fixture; got ${rankingPrompt.length} characters`
);
for (const omittedKey of ['"notes":', '"url":', '"status":', '"constraint_match":', '"constraint_miss":', '"how_to_use":']) {
  assert.equal(
    rankingPrompt.includes(omittedKey),
    false,
    `compact ranking prompt must omit ${omittedKey}`
  );
}
const meshyCompact = compactRankingResource(catalog.find((item) => item.id === 'meshy-ai'));
assert.equal(Object.hasOwn(meshyCompact, 'notes'), false);
assert.equal(Object.hasOwn(meshyCompact, 'url'), false);
assert.equal(Object.hasOwn(meshyCompact, 'status'), false);
assert.ok(Array.isArray(meshyCompact.use_cases) && meshyCompact.use_cases.length <= 3);

const minimalRanked = validateRecommendations({
  no_match: false,
  recommendations: [{ id: 'meshy-ai', fit_score: 95, reason: '可直接把文字或圖片轉成遊戲原型可用的 3D 模型。' }]
}, rankingCandidates, rankingIntent);
assert.equal(minimalRanked.no_match, false);
assert.equal(minimalRanked.recommendations[0]?.id, 'meshy-ai');
assert.equal(minimalRanked.recommendations[0]?.role, '推薦候選');
assert.ok(minimalRanked.recommendations[0]?.how_to_use);
assert.deepEqual(JSON.parse(JSON.stringify(minimalRanked.recommendations[0]?.constraint_match)), []);
assert.deepEqual(JSON.parse(JSON.stringify(minimalRanked.recommendations[0]?.constraint_miss)), []);

const trueNoMatch = validateRecommendations({ no_match: true, recommendations: [] }, rankingCandidates, rankingIntent);
assert.equal(trueNoMatch.no_match, true);
assert.ok(trueNoMatch.missing_capability);

const recovered = fallbackRecommendations(
  fallbackIntent('我要從文字快速生成可以拿去做遊戲原型的 3D 模型'),
  catalog
);
assert.ok(
  recovered.some((item) => item.id === 'meshy-ai'),
  `expected meshy-ai recovery, got ${JSON.stringify(recovered)}`
);

const localVoiceQuery = '我要在本機做語音複製和配音，不想依賴雲端訂閱服務';
const localVoiceConcepts = fallbackQueryConcepts(localVoiceQuery);
assert.ok(
  localVoiceConcepts.some((concept) => concept.includes('語音') || concept.includes('配音')),
  `expected positive voice concepts, got ${JSON.stringify(localVoiceConcepts)}`
);
assert.equal(
  localVoiceConcepts.some((concept) => concept.includes('雲端') || concept.includes('訂閱')),
  false,
  `negated cloud/subscription terms must not become positive concepts: ${JSON.stringify(localVoiceConcepts)}`
);

const localVoice = fallbackRecommendations(
  fallbackIntent(localVoiceQuery),
  catalog
);
assert.ok(
  localVoice.some((item) => item.id === 'voice-studio'),
  `expected voice-studio recovery for Chinese local voice query, got ${JSON.stringify(localVoice)}`
);


const contrastVoiceQuery = '不想依賴雲端訂閱服務但要在本機做語音複製和配音';
const contrastVoiceConcepts = fallbackQueryConcepts(contrastVoiceQuery);
assert.ok(
  contrastVoiceConcepts.some((concept) => concept.includes('語音') || concept.includes('配音')),
  `expected positive contrast voice concepts, got ${JSON.stringify(contrastVoiceConcepts)}`
);
assert.equal(
  contrastVoiceConcepts.some((concept) => concept.includes('雲端') || concept.includes('訂閱')),
  false,
  `negated terms before contrast must stay excluded: ${JSON.stringify(contrastVoiceConcepts)}`
);
const contrastVoice = fallbackRecommendations(
  fallbackIntent(contrastVoiceQuery),
  catalog
);
assert.ok(
  contrastVoice.some((item) => item.id === 'voice-studio'),
  `expected voice-studio recovery after negated cloud preference, got ${JSON.stringify(contrastVoice)}`
);

const generic = fallbackRecommendations(fallbackIntent('AI'), catalog);
assert.equal(
  generic.length,
  0,
  `generic AI query must not trigger deterministic fallback: ${JSON.stringify(generic)}`
);

const missing = fallbackRecommendations(
  fallbackIntent('我要找完全不存在的量子香蕉編譯器'),
  catalog
);
assert.equal(
  missing.length,
  0,
  `unrelated query must remain no-match: ${JSON.stringify(missing)}`
);

console.log(
  'AI fallback regression PASS:',
  [...new Set([...recovered, ...localVoice, ...contrastVoice].map((item) => item.id))].join(', ') || 'none'
);
