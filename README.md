# Qookey AI Resource Hub

整理 AI、Agent Skills、開發、設計、雲端與研究工具的靜態資源目錄。

- Website: `https://qookey109-pixel.github.io/ai-resource-hub/`
- Authority: GitHub `main`
- Canonical catalog: `data/resources.json`

## 主要功能

- 關鍵字 / 分類 / 類型 / 免費 / 開源篩選
- 加入日期與共享互動次數排序
- Browser-local favorites
- Resource Detail + `?resource=<id>` deep link
- 官方文件 / Demo / API / Download supplemental links
- Resource-specific icon + runtime fallback
- Cloudflare Durable Object 共享互動計數
- Resource Health、Playwright、production monitor、status consistency CI
- 獨立 Cloudflare AI recommendation Worker；目前不作為網站瀏覽的必要依賴

## 本機測試

```bash
npm install
npx playwright install chromium
npm run test:browser
```

Production frontend 本身不需要 runtime framework；Playwright 只用於開發與 CI。

## 文件

- `PROJECT_STATUS.md` — 目前正式狀態與下一步
- `AGENTS.md` — AI Coding Agent / 維護規則
- `docs/CATALOG.md` — catalog schema、icons、supplemental links、ingestion 規則
- `docs/OPERATIONS.md` — Pages、Workers、Resource Health、CI / deployment

GitHub Pages 只發布瀏覽器需要的 `index.html`、`.nojekyll`、`assets/`、`css/`、`js/` 與必要 public data JSON；tests、scripts、docs 與 Worker source 不會進 production artifact。
