# Catalog Contract

This document defines the public resource-data contract.

## Authorities

- `data/resources.json` — resource identity and canonical primary URL
- `data/categories.json` — allowed categories
- `data/resource-icons.json` — resource-specific icons
- `data/resource-links.json` — verified supplemental public links
- `data/resource-health-expectations.json` — reviewed health-policy exceptions

A supplemental registry must never override resource identity.

## Resource shape

```json
{
  "id": "stable-kebab-case-id",
  "name": "Resource name",
  "type": "github",
  "url": "https://example.com",
  "categories": ["AI Coding"],
  "tags": ["agent", "coding"],
  "summary": "繁體中文簡介",
  "use_cases": ["繁體中文用途"],
  "pricing": "open-source",
  "open_source": true,
  "license": "MIT",
  "difficulty": "intermediate",
  "status": "active",
  "rating": 4,
  "added_at": "YYYY-MM-DD",
  "last_checked": "YYYY-MM-DD",
  "notes": "繁體中文補充"
}
```

Stable IDs should not change only because a display name changes.

### Enums

`type`:

- `website`
- `github`
- `documentation`
- `service`
- `library`
- `model`
- `dataset`
- `platform`
- `other`

`pricing`: `free`, `freemium`, `paid`, `open-source`, `unknown`

`difficulty`: `beginner`, `intermediate`, `advanced`, `unknown`

`status`: `active`, `inactive`, `deprecated`, `archived`, `unknown`

`open_source`: `true`, `false`, or `null`

`rating` is an internal editorial usefulness score, not external source metadata.

## Supplemental links

`data/resource-links.json` keys must match existing resource IDs.

Supported `kind` values:

- `github`
- `website`
- `documentation`
- `demo`
- `gallery`
- `api`
- `download`
- `other`

Rules:

- only stable, public, verified official/project links
- do not repeat the canonical primary URL
- do not add account-specific dashboards, signed URLs, tokens or auth flows
- prefer HTTPS and stable URLs
- labels/descriptions use Traditional Chinese by default
- supplemental links may improve search discovery but never create a second resource identity

Validators:

- `scripts/resource_health.py --validate-only` — catalog IDs/URLs, enums, categories, lower-case tags, dates, 1:1 icon coverage, and non-blocking icon-source quality metrics
- `scripts/resource_links_validate.py` — supplemental-link structure and resource references

## Ingestion checklist

1. Re-read latest `main`.
2. Verify canonical identity and URL.
3. Check duplicate URL, alias and project identity.
4. Read README / License / official docs before filling factual metadata.
5. Use `unknown` / `null` rather than guessing.
6. Use existing categories and lower-case tags.
7. Add a verified icon or an explicit fallback.
8. Add useful official secondary links.
9. Update `last_checked`.
10. Run catalog / link / browser validation before merge.
