# Qookey AI Resource Hub

Qookey AI Resource Hub 是一個以靜態 GitHub Pages 為主的 AI / Agent / 開發資源目錄。

- Website: `https://qookey109-pixel.github.io/ai-resource-hub/`
- Repository authority: GitHub `main`
- Canonical catalog: `data/resources.json`
- Current catalog: **86 resources**

## 目前功能

- 關鍵字、分類、類型、免費 / 開源篩選
- 加入日期與共享互動次數排序
- 快速分類與手機版 sticky search
- Browser-local favorites
- Resource Detail dialog 與 `?resource=<id>` deep link
- 官方文件 / Demo / API / Download 等 supplemental links
- Resource-specific icon + runtime fallback
- Cloudflare Durable Object 共享互動計數
- Resource Health 非破壞式網址 / GitHub 健康檢查
- Cloudflare AI recommendation backend 已部署並持續監控
- Playwright browser regression、production monitor、status consistency CI

目前網站前端本身保持 dependency-free；AI backend 與瀏覽 / 搜尋 UI 分離，沒有 standalone AI recommendation panel。

## 專案結構

```text
.
├── index.html
├── assets/
│   └── qookey-logo.svg
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── favorites.js
│   ├── icon-reliability.js
│   ├── resource-detail.js
│   ├── resource-links.js
│   └── sliced-waves-background.js
├── data/
│   ├── resources.json
│   ├── categories.json
│   ├── resource-icons.json
│   ├── resource-links.json
│   ├── resource-health-expectations.json
│   ├── ai-config.json
│   └── click-config.json
├── docs/
├── scripts/
├── tests/
├── worker/
├── worker-clicks/
└── .github/workflows/
```

Production Pages 只發布 `index.html`、`.nojekyll`、`assets/`、`css/`、`js/` 與前端實際需要的 data JSON；tests、scripts、docs、Workers 原始碼不會進 Pages artifact。

## 資料權威

- `data/resources.json`: resource identity + canonical primary URL
- `data/categories.json`: categories
- `data/resource-icons.json`: resource-specific icons
- `data/resource-links.json`: verified supplemental official links
- `data/resource-health-expectations.json`: reviewed health expectations
- `data/ai-config.json`: AI Worker runtime config
- `data/click-config.json`: shared interaction counter frontend config

Supplemental links 不能建立第二個 resource identity，也不能覆蓋 canonical URL。

## 新增資源規則

1. 先重新讀最新 `main`。
2. 核對 canonical URL 與專案身分。
3. 直接檢查 `data/resources.json`，避免 alias / duplicate。
4. README / License / 官方文件能驗證才填；不能驗證就用 `unknown` / `null`。
5. 使用既有分類；tags 使用小寫。
6. 額外官方文件、Demo、API、Download 放進 `data/resource-links.json`。
7. 不公開 credentials、tokens、private dashboard URLs 或暫時登入 URL。
8. 修改後跑 JSON / Resource Health / Project Status / Playwright。

## 本機測試

```bash
npm install
npx playwright install chromium
npm run test:browser
```

Playwright 只用於開發與 CI，不會打包進 production Pages。

## 部署與監控

- Pages: `.github/workflows/pages.yml`
- Frontend regression: `.github/workflows/frontend-interaction.yml`
- Resource Health: `.github/workflows/resource-health.yml`
- Project Status consistency: `.github/workflows/project-status-consistency.yml`
- Production Worker monitor: `.github/workflows/production-worker-monitor.yml`
- AI Worker deploy: `.github/workflows/deploy-ai-worker.yml`
- Click Worker deploy: `.github/workflows/deploy-click-worker.yml`

更完整的目前狀態與維護邊界以 `PROJECT_STATUS.md` 為準。
