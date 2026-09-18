# Project Status

Status date: 2026-09-18 (Asia/Taipei)

## Current authority

- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Website: `https://qookey109-pixel.github.io/ai-resource-hub/`
- Canonical catalog: **86 resources**
- Catalog identity authority: `data/resources.json`

## Production baseline

Frontend:

- static GitHub Pages
- dependency-free browsing runtime
- one production stylesheet: `css/styles.css`
- focused modules under `js/`
- structured search + filters + sorting
- browser-local favorites
- Resource Detail + stable `?resource=<id>` deep links
- verified supplemental official links
- icon registry + runtime fallback
- shared aggregate interaction counts

Services:

- AI recommender Worker: runtime version **0.3.2**, model **`@cf/zai-org/glm-4.7-flash`**
- Click Worker: Cloudflare Durable Object counter
- AI is deployed and monitored but is not required for normal catalog browsing

Quality gates:

- Playwright browser regression + site smoke tests
- Resource Health structural validation and reviewed triage
- Project Status consistency
- Production Worker monitor
- bounded Worker deployment health / semantic checks

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

- continue replacing low-quality third-party icons when a better verified official asset exists
- expand useful official-link coverage
- consider semantic/vector search only when structured search becomes insufficient
- consider metadata-refresh PR automation after the evidence-only health workflow is mature
