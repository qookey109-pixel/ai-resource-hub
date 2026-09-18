#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workerPath = 'worker/src/index.js';
const catalogPath = 'data/resources.json';

let source = fs.readFileSync(workerPath, 'utf8');
assert.match(
  source,
  /ranked\.no_match\s*&&\s*intentMode\s*===\s*['"]fallback['"]/, 
  'Worker must retain the fallback-intent + no-match recovery guard.'
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
  'globalThis.__test = { parseJsonObject, normaliseWorkflowScope, fallbackQueryConcepts, fallbackIntent, fallbackRecommendations, prefilterResources }; globalThis.__worker = {'
);

const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')).resources;
assert.ok(Array.isArray(catalog) && catalog.length > 0, 'catalog must contain resources');

const {
  parseJsonObject,
  normaliseWorkflowScope,
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
