# Project Status

Status date: 2026-09-18 (Asia/Taipei)

## Current authority

- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Website: `https://qookey109-pixel.github.io/ai-resource-hub/`
- Current canonical catalog size: **86 resources**
- Catalog identity authority: `data/resources.json`

## Production baseline

Frontend:

- static GitHub Pages
- dependency-free browsing runtime
- one production stylesheet: `css/styles.css`
- focused modules under `js/`
- structured search + category navigation + sorting, including Traditional Chinese aliases and token-safe security acronym matching
- browser-local favorites
- Resource Detail + stable `?resource=<id>` deep links
- verified supplemental official links
- icon registry + runtime fallback
- shared aggregate interaction counts

Services:

- AI recommender Worker: runtime version **0.3.3**, model **`@cf/zai-org/glm-4.7-flash`**
- Click Worker: Cloudflare Durable Object counter
- AI is deployed and monitored but is not required for normal catalog browsing

Quality gates:

- Playwright browser regression + site smoke tests
- Resource Health structural validation, live URL/GitHub observation, metadata-freshness evidence, and reviewed triage
- Project Status consistency
- Production Worker monitor
- bounded Worker deployment health / semantic checks

Data quality snapshot:

- supplemental official links: **85 / 86 resources (98.8%)**
- canonical-only exception: `xorxor-hu-codepen` until a second verified official endpoint exists
- icon registry coverage: **86 / 86 resources**
- icon sources (mutually exclusive): **42 official-labelled**, **13 GitHub-avatar**, **24 fallback-labelled**, **7 domain-favicon**
- metadata freshness: Resource Health emits `last_checked` age buckets as evidence only; freshness never rewrites catalog metadata or changes triage state by itself

## Current maintenance boundary

- Catalog changes must preserve stable resource IDs and canonical URLs.
- Supplemental links never create a second identity.
- Shared interaction counts must not be reset during catalog or UI maintenance.
- Pages publishes an allowlisted static artifact rather than the repository root.
- Historical implementation details and old run IDs remain in Git / Actions, not in current docs.

Detailed maintenance rules: `AGENTS.md`  
Catalog/data contract: `docs/CATALOG.md`  
Deployment/monitoring: `docs/OPERATIONS.md`

## Follow-ups

- continue replacing avatar/fallback icons only when a better verified official project asset exists
- maintain near-complete supplemental-link coverage; do not add weak links only to reach 100%
- consider semantic/vector search only when structured search becomes insufficient
- metadata freshness evidence is now live; any future metadata-refresh automation must remain evidence/PR-only until reviewed before production promotion
