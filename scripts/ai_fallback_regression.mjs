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
  'globalThis.__test = { fallbackIntent, fallbackRecommendations }; globalThis.__worker = {'
);

const context = { console };
vm.createContext(context);
vm.runInContext(source, context);

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')).resources;
assert.ok(Array.isArray(catalog) && catalog.length > 0, 'catalog must contain resources');

const { fallbackIntent, fallbackRecommendations } = context.__test;

const recovered = fallbackRecommendations(
  fallbackIntent('我要從文字快速生成可以拿去做遊戲原型的 3D 模型'),
  catalog
);
assert.ok(
  recovered.some((item) => item.id === 'meshy-ai'),
  `expected meshy-ai recovery, got ${JSON.stringify(recovered)}`
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
  recovered.map((item) => item.id).join(', ') || 'none'
);
