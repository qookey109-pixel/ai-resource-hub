# Resource Links Registry

`data/resource-links.json` stores **verified secondary public links** for resources already identified by `data/resources.json`.

It is not a second resource catalog. Resource identity and canonical primary URLs remain authoritative in `data/resources.json`.

## Shape

```json
{
  "schema_version": "0.1",
  "updated_at": "YYYY-MM-DD",
  "links": {
    "resource-id": [
      {
        "label": "官方文件",
        "kind": "documentation",
        "url": "https://example.com/docs",
        "description": "繁體中文簡短說明。"
      }
    ]
  }
}
```

## Supported kinds

- `github`
- `website`
- `documentation`
- `demo`
- `gallery`
- `api`
- `download`
- `other`

Validation authority: `scripts/resource_links_validate.py`.

## Rules

1. The key must match an existing stable resource `id`.
2. Add only stable, public, verified official/project links.
3. Do not add account-specific dashboards, temporary auth flows, tokens, signed URLs or private links.
4. Do not repeat the canonical primary URL; Resource Detail injects it automatically.
5. Prefer HTTPS and stable URLs without tracking parameters or fragments.
6. `label` and `description` should be Traditional Chinese by default.
7. Supplemental links may improve discovery but must never create a second resource identity.
