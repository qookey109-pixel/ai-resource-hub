# Resource Links Registry V0.1

`data/resource-links.json` stores **verified secondary public links** for resources already identified by `data/resources.json`.

It is not a second resource catalog. Resource identity, canonical primary URL, categories, descriptions and other core metadata remain authoritative in `data/resources.json`.

## Document shape

```json
{
  "schema_version": "0.1",
  "updated_at": "YYYY-MM-DD",
  "links": {
    "resource-id": [
      {
        "label": "官方網站",
        "kind": "website",
        "url": "https://example.com/",
        "description": "給網站使用者看的繁體中文簡短說明。"
      }
    ]
  }
}
```

## Supported link kinds

The frontend currently localizes these kinds:

- `github`
- `website`
- `documentation`
- `demo`
- `gallery`
- `api`
- `download`
- `other`

Unknown kinds remain safe and render as a generic link label.

## Rules

1. The key must match an existing stable resource `id` from `data/resources.json`.
2. Only add stable, public, verified official/project links.
3. Do not add account-specific dashboards, temporary auth flows, tokens, signed URLs or private links.
4. Do not repeat the canonical primary URL from `data/resources.json`; the detail UI injects it automatically.
5. Prefer HTTPS and canonical URLs without unnecessary tracking parameters or fragments.
6. `label` and `description` should be Traditional Chinese by default; official product names such as `Proof Lab` may remain unchanged.
7. A secondary link must not change the identity or verified core metadata of the resource.

## Current seeded resources

- `tt-a1i-archify`: official Project Page, Scenario Guide and Proof Lab.
- `token-gremlin-abyssal`: official GitHub Pages Live Demo.
