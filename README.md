# Qookey AI Resource Hub

AI 資源整合網：集中整理 AI 網站、GitHub 專案、開發工具、Agent、MCP、Skills、自動化服務與相關資源，並提供搜尋、分類、篩選與後續 AI 推薦能力。

## V0.1 目標

- 將資源以固定 schema 儲存在 `data/resources.json`
- 支援一個資源多分類、多標籤
- 提供名稱、描述、分類與標籤搜尋
- 提供分類、免費、開源等基本篩選
- GitHub Repository `main` 作為 V0.1 正式資料 authority
- 保留未來 AI recommendation engine 的擴充空間

## 專案結構

```text
ai-resource-hub/
├── README.md
├── PROJECT_STATUS.md
├── AGENTS.md
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── data/
│   ├── resources.json
│   └── categories.json
└── docs/
    └── RESOURCE_SCHEMA.md
```

## 新增資源流程

1. 檢查網址與資源身份。
2. 判斷主要用途與適用情境。
3. 檢查是否與現有資源重複。
4. 套用 `docs/RESOURCE_SCHEMA.md`。
5. 分配分類與標籤。
6. 更新 `data/resources.json`。
7. 驗證 JSON 與前端顯示。

## 本機預覽

這是純靜態網站。可直接用任何 static server 在 repository 根目錄預覽，例如：

```bash
python3 -m http.server 8000
```

然後開啟 `http://localhost:8000`。

## 狀態

目前為 **V0.1 foundation**。詳細進度請看 `PROJECT_STATUS.md`。
