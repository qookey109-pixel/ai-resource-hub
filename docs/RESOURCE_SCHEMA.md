# Resource Schema V0.1

`data/resources.json` is the canonical V0.x catalog.

## Top-level document

```json
{
  "schema_version": "0.1",
  "updated_at": "YYYY-MM-DD",
  "resources": []
}
```

## Resource object

```json
{
  "id": "stable-kebab-case-id",
  "name": "Resource name",
  "type": "github",
  "url": "https://example.com",
  "categories": ["AI Coding"],
  "tags": ["agent", "coding"],
  "summary": "給網站使用者看的繁體中文簡介。",
  "use_cases": ["給網站使用者看的繁體中文用途"],
  "pricing": "free",
  "open_source": true,
  "license": "MIT",
  "difficulty": "intermediate",
  "status": "active",
  "rating": 4,
  "added_at": "2026-08-23",
  "last_checked": "2026-08-23",
  "notes": "繁體中文補充說明。"
}
```

## Field rules

### `id`
Stable, unique, lower-case kebab-case identifier. Do not change it just because the display name changes.

### `name`
保留資源的正式名稱或品牌名稱，不強制翻譯。

### `type`
Allowed V0.1 values:

- `website`
- `github`
- `documentation`
- `service`
- `library`
- `model`
- `dataset`
- `platform`
- `other`

### `categories`
One or more display categories from `data/categories.json`. Multi-category assignment is encouraged when genuinely useful.

### `tags`
Lower-case retrieval terms. Prefer specific capabilities over marketing language. Tags may remain English when that improves technical searchability.

### User-facing descriptive copy
以下欄位預設必須使用繁體中文：

- `summary`
- `use_cases`
- `notes`

技術名詞、產品名稱、API 名稱與無自然中文譯名的專有名詞可以保留英文。不要為了中文化而扭曲原始含義。

### `pricing`
Allowed values:

- `free`
- `freemium`
- `paid`
- `open-source`
- `unknown`

The frontend localizes these enum values for display.

### `open_source`
Use `true`, `false`, or `null` when unknown/not applicable.

### `license`
Use a verified SPDX-like license name when available, otherwise `null`.

### `difficulty`
Allowed values:

- `beginner`
- `intermediate`
- `advanced`
- `unknown`

### `status`
Allowed values:

- `active`
- `inactive`
- `deprecated`
- `archived`
- `unknown`

### `rating`
Editorial usefulness score from 1 to 5, or `null` until reviewed. This is not source metadata and must not be presented as an objective external rating.

### Dates
Use ISO `YYYY-MM-DD` dates for `added_at` and `last_checked`.

## Ingestion requirements

Before adding a resource:

1. Verify the canonical resource and URL.
2. Check the current catalog for duplicate URL, duplicate project, or alias.
3. Verify factual metadata from the source where practical.
4. Use `unknown`/`null` rather than guessing.
5. Write user-facing descriptive copy in Traditional Chinese.
6. Sanitize private dashboard paths, temporary auth flows, tokens and secret-bearing URLs before publication.
7. Validate the complete JSON document after editing.
