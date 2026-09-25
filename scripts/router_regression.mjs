#!/usr/bin/env node

import assert from 'node:assert/strict';
import { clarificationFor } from '../worker/src/router.js';

function expectRoute(query, domain, expectedChoiceCount = 4) {
  const rule = clarificationFor(query);
  assert.ok(rule, `expected a route for: ${query}`);
  assert.equal(rule.domain, domain, `unexpected domain for: ${query}`);
  assert.equal(rule.choices.length, expectedChoiceCount, `unexpected choice count for: ${query}`);
  assert.ok(rule.question.length > 0, `missing clarification question for: ${query}`);
  return rule;
}

expectRoute('我想找 MCP', 'mcp');
assert.equal(clarificationFor('找 GitHub MCP'), null, 'qualified MCP requests must not be interrupted');

expectRoute('我想找 AI Coding 工具', 'ai-coding');
assert.equal(clarificationFor('我要找 Cursor AI Coding'), null, 'named AI Coding tools must pass through');

expectRoute('我想找 AI agent 工具', 'agent-ecosystem');
assert.equal(clarificationFor('找 agent memory 工具'), null, 'qualified Agent requests must pass through');

expectRoute('我要做網站', 'website');
expectRoute('我要做 3D 模型', '3d');

assert.equal(
  clarificationFor('我要做網站，而且需要會員登入、後台、付款、資料庫與部署流程'),
  null,
  'long, already-specific requests must skip the fast clarification layer'
);

console.log('Typed System-1 router regression PASS');
