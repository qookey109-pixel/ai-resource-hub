# Operations

Current deployment and monitoring contract for Qookey AI Resource Hub.

## GitHub Pages

Workflow: `.github/workflows/pages.yml`

Pages publishes only browser-required files:

- `index.html`
- `.nojekyll`
- `robots.txt`
- `sitemap.xml`
- `assets/`
- `css/`
- `js/`
- `data/resources.json`
- `data/categories.json`
- `data/resource-icons.json`
- `data/resource-links.json`
- `data/click-config.json`

Tests, scripts, docs, Worker source and health-governance data are repository-only.

## Frontend regression

Workflow: `.github/workflows/frontend-interaction.yml`

`npm run test:browser` covers critical interaction and smoke behavior, including:

- card → detail dialog
- deep links / browser history
- favorites vs external-link separation
- search discovery, including natural Traditional Chinese QA corpus coverage and negative precision checks
- icon fallback
- date / click sorting
- full catalog render
- JS runtime errors
- mobile horizontal overflow
- sticky compact-search accessibility

## AI recommender Worker

Source: `worker/`  
Deploy workflow: `.github/workflows/deploy-ai-worker.yml`

Current runtime:

- version: `0.3.3`
- model: `@cf/zai-org/glm-4.7-flash`
- endpoint: `POST /api/recommend`
- health: `GET /health`
- catalog source: public GitHub `main` `data/resources.json`
- output IDs are validated against the catalog
- deterministic fallback is retained for model / intent failures
- AI fallback regression: `.github/workflows/ai-fallback-regression.yml` runs deterministic fallback fixtures on relevant PRs and main pushes

The Worker is deployed and monitored, but normal website browsing does not depend on it.

`data/ai-config.json` records the deployed endpoint for operations/monitoring.

## Click Worker

Source: `worker-clicks/`  
Deploy workflow: `.github/workflows/deploy-click-worker.yml`

- Durable Object stores aggregate counts
- frontend reads counts and records interactions
- production monitor is GET-only and never increments counts
- `data/click-config.json` is the public frontend endpoint config

## Resource Health

Workflow: `.github/workflows/resource-health.yml`

- pull requests run structural validation only
- scheduled/manual/relevant main runs observe live URLs and GitHub metadata
- raw observations are evidence, not automatic catalog mutations
- reports include `last_checked` age buckets so metadata freshness can be reviewed without silently rewriting production fields
- reviewed summaries include a bounded oldest-first metadata refresh queue for resources older than 14 days
- freshness age and queue position are evidence only; they do not change triage state by themselves
- reviewed expectations live in `data/resource-health-expectations.json`
- output reports are Actions artifacts, not committed history

Reviewed triage states:

- `clean`
- `expected-variance`
- `review-required`

Catalog metadata still requires review before promotion.

## Production Worker Monitor

Workflow: `.github/workflows/production-worker-monitor.yml`

Checks:

- AI health
- click Worker health
- click GET contract
- AI recommendation contract
- recommendation IDs resolve to current catalog
- semantic fixture returns an expected resource

## Deployment boundaries

- Worker deployments require Cloudflare credentials from repository secrets.
- Never store Cloudflare tokens or provider keys in frontend code or catalog data.
- Deployment verification must be bounded by job/request timeouts.
- Endpoint config should only change when the resolved endpoint actually changes.
- Catalog-only additions do not require Worker deployment.
