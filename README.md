# Qookey AI Resource Hub

專注整理 **AI Coding、Agent Skills、MCP / Agent Frameworks 與 Developer Tools** 的靜態資源中心；其他 AI、設計、影音、雲端與研究工具作為延伸資源。

- Website: `https://qookey109-pixel.github.io/ai-resource-hub/`
- Authority: GitHub `main`
- Canonical catalog: `data/resources.json`
- Current status: `PROJECT_STATUS.md`

## 架構

- **Static catalog** — GitHub Pages；正常瀏覽不依賴 AI 或後端服務
- **Structured search** — 關鍵字、自然繁中查詢、分類與排序
- **System-1 router** — 對短而模糊的 MCP / AI Coding / Agent 等需求先做 deterministic typed-choice 澄清
- **AI recommender** — Cloudflare Worker；只在需要時做 intent understanding 與 catalog ranking
- **Deterministic fallback** — AI 額度、容量或推論失敗時仍可回復基本推薦
- **Shared interactions** — Cloudflare Durable Object 保存聚合點擊數；favorites 留在瀏覽器本機

## 主要功能

- AI Coding / Agent / MCP 核心分類導覽
- 自然繁中搜尋與同義詞 discovery
- 加入日期與共享互動次數排序
- Browser-local favorites
- Resource Detail + `?resource=<id>` stable deep link
- 官方文件 / Demo / API / Download supplemental links
- Resource-specific icon + runtime fallback
- Resource Health、Playwright、Worker monitor、status consistency CI

## 本機驗證

```bash
npm install
npx playwright install chromium
npm run test:browser
node scripts/ai_fallback_regression.mjs
node scripts/router_regression.mjs
python scripts/project_status_consistency.py
```

Production frontend 本身不需要 runtime framework；Playwright 只用於開發與 CI。

## 文件

- `PROJECT_STATUS.md` — 正式狀態、產品定位與維護邊界
- `AGENTS.md` — AI Coding Agent / 維護規則
- `docs/CATALOG.md` — catalog schema、icons、supplemental links、ingestion
- `docs/OPERATIONS.md` — Pages、Workers、Resource Health、CI / deployment

GitHub Pages 只發布瀏覽器需要的 allowlisted static artifact；tests、scripts、docs 與 Worker source 不進 production artifact。
