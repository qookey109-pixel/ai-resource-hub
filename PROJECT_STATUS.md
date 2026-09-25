# Project Status

Status date: 2026-09-25 (Asia/Taipei)

## Current authority

- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Website: `https://qookey109-pixel.github.io/ai-resource-hub/`
- Current canonical catalog size: **97 resources**
- Catalog identity authority: `data/resources.json`

## Production baseline

Frontend:

- static GitHub Pages
- dependency-free browsing runtime
- one production stylesheet: `css/styles.css`
- focused modules under `js/`
- structured search + natural Traditional Chinese query tokenization + category navigation + sorting, including aliases and token-safe security acronym matching
- browser-local favorites
- Resource Detail + stable `?resource=<id>` deep links
- verified supplemental official links
- icon registry + runtime fallback
- shared aggregate interaction counts

Services:

- AI recommender Worker: runtime version **0.3.12**, model **`@cf/zai-org/glm-4.7-flash`**
- Click Worker: Cloudflare Durable Object counter
- AI is deployed and monitored but is not required for normal catalog browsing
- short ambiguous MCP / AI Coding / Agent requests are routed through a deterministic typed-choice System-1 clarification layer before model inference

Quality gates:

- Playwright browser regression + site smoke tests, including a 52-case real-world Traditional Chinese search QA corpus and negative precision guards
- Resource Health structural validation, live URL/GitHub observation, metadata-freshness evidence, and reviewed triage
- Project Status consistency
- Production Worker monitor with degraded-mode latency / diagnostic evidence
- bounded Worker deployment health / semantic checks
- deterministic fallback + typed System-1 router regression

Data quality snapshot:

- supplemental official links: **97 / 97 resources (100%)**
- icon registry coverage: **97 / 97 resources**
- icon sources (mutually exclusive): **46 official-labelled**, **21 GitHub-avatar**, **22 fallback-labelled**, **8 domain-favicon**
- metadata freshness: Resource Health emits `last_checked` age buckets as evidence only; freshness never rewrites catalog metadata or changes triage state by itself

## Product position

- Primary focus: **AI Coding / Agent ecosystem**
- Core discovery surfaces prioritize **AI Coding**, **Agent Skills**, **MCP / Agent Frameworks**, and **Developer Tools**
- Broader AI categories remain searchable as supporting resources; sparse categories do not need equal navigation weight
- v1 is feature-complete and should prefer maintenance over breadth-driven expansion

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

- maintenance mode: add resources selectively, fix production issues, and avoid breadth-driven feature expansion
- continue replacing avatar/fallback icons only when a better verified official project asset exists
- maintain full supplemental-link coverage only while every added endpoint remains independently verified; never preserve 100% by adding weak links
- consider semantic/vector search only when structured search becomes insufficient
- metadata freshness evidence is now live; any future metadata-refresh automation must remain evidence/PR-only until reviewed before production promotion
