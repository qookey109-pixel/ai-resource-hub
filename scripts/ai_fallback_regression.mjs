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

source = source.replace(
  'export default {',
  'globalThis.__test = { fallbackQueryConcepts, fallbackIntent, fallbackRecommendations }; globalThis.__worker = {'
);

const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')).resources;
assert.ok(Array.isArray(catalog) && catalog.length > 0, 'catalog must contain resources');

const { fallbackQueryConcepts, fallbackIntent, fallbackRecommendations } = context.__test;

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
