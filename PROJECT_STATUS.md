# Project Status

Status date: 2026-09-18 (Asia/Taipei)

## Project

- Name: Qookey AI Resource Hub
- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Website: `https://qookey109-pixel.github.io/ai-resource-hub/`
- Current canonical catalog size: **86 resources**

## Current baseline

The project is a static, dependency-free resource marketplace frontend backed by canonical JSON data, with separate Cloudflare Workers for AI recommendation and shared interaction counts.

Current production capabilities:

- structured search across canonical metadata and verified supplemental links
- category / type / free / open-source filters
- newest / oldest and shared-interaction sorting
- browser-local favorites
- responsive resource cards and Resource Detail dialog
- stable `?resource=<id>` deep links with Back/Forward support
- verified supplemental official links
- resource-specific icons with runtime fallback
- shared aggregate interaction counts
- Resource Health V0.2
- production Worker monitoring
- Playwright frontend regressions
- status consistency CI

The AI recommendation Worker remains deployed and monitored, but the current marketplace UI does **not** expose a standalone AI recommendation panel. Browsing and search remain local/deterministic and do not require the AI backend.

## Canonical authorities

- Resource identity + primary URL: `data/resources.json`
- Categories: `data/categories.json`
- Icons: `data/resource-icons.json`
- Supplemental links: `data/resource-links.json`
- Health expectations: `data/resource-health-expectations.json`
- AI Worker config: `data/ai-config.json`
- Click counter config: `data/click-config.json`
- AI Worker source: `worker/`
- Click Worker source: `worker-clicks/`

## Frontend structure

Production source is intentionally small:

- `index.html`
- `assets/qookey-logo.svg`
- one stylesheet: `css/styles.css`
- focused JS modules under `js/`
- required public JSON under `data/`

Historical patch stylesheets have been consolidated into `css/styles.css`. Do not reintroduce one-off CSS patch files unless there is a clear architectural reason.

GitHub Pages stages only the files the browser needs. Repository-only material such as tests, scripts, docs, Worker source and health governance data is not part of the Pages artifact.

## Testing and operations

Maintained workflows:

- `pages.yml`: GitHub Pages
- `frontend-interaction.yml`: Playwright browser regression
- `resource-health.yml`: URL / GitHub observation + reviewed triage
- `project-status-consistency.yml`: catalog count / date consistency
- `production-worker-monitor.yml`: live AI Worker + click Worker monitoring
- `deploy-ai-worker.yml`: AI Worker deployment
- `deploy-click-worker.yml`: click Worker deployment

Production monitor reads the click API only; it must not generate synthetic click increments.

## Current maintenance rules

1. Re-read latest `main` before every ingestion or structural change.
2. Do not duplicate an existing resource or alias.
3. Keep `data/resources.json` as identity authority.
4. Supplemental links never override canonical identity.
5. Do not guess pricing, license or status.
6. Keep secrets, credentials, private dashboard state and temporary auth URLs out of the catalog.
7. Keep production frontend dependency-free unless a clear benefit justifies a change.
8. Prefer editing the existing stylesheet / module over adding patch files.
9. Frontend interaction or discovery changes must pass Playwright.
10. External health observations are evidence only; they do not silently rewrite verified catalog metadata.
11. Shared interaction counts must not be reset by catalog or UI maintenance.
12. Worker deployment remains separate from catalog-only additions.

## Known follow-ups

- continue verified official-link coverage where useful
- replace remaining low-quality third-party icons when a better official asset is verified
- consider semantic/vector search only if structured search becomes insufficient at larger catalog size
- consider automated metadata-refresh PRs after the current evidence-only health workflow is stable
- consider account/cloud-synced collections only if browser-local favorites become insufficient

Historical implementation details, old ingestion batches and previous CI run IDs remain available in Git history and Actions rather than being duplicated here.
