# Project Status

Status date: 2026-08-23 (Asia/Taipei)

## Project

- Name: Qookey AI Resource Hub
- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Current version: **V0.2 searchable website**
- GitHub Pages target: `https://qookey109-pixel.github.io/ai-resource-hub/`

## Completed

- Repository foundation and governance files established.
- Canonical V0.1 resource schema established.
- Canonical category catalog established.
- First two user-supplied resource batches ingested and reviewed.
- Catalog now contains **13 resources**.
- Account-specific / temporary URLs are sanitized before publication.
- Search, category filter, type filter, free/open-source filters, sorting and quick-category navigation implemented.
- Responsive desktop/mobile visual redesign completed.
- GitHub Pages deployment workflow added at `.github/workflows/pages.yml`.
- `.nojekyll` added for static-site publishing.

## Current catalog

- Total resources: 13
- Resource authority: `data/resources.json`
- Category authority: `data/categories.json`
- Multi-category classification is enabled.
- Unknown metadata remains `unknown` / `null` instead of being guessed.

## Current resource groups represented

- Agent Skills / AI Coding
- UI / UX / frontend references
- Image / mascot generation workflows
- Audio / music production resources
- Cloud deployment and infrastructure
- Databases / backend platforms
- AI / LLM developer platforms
- Skill marketplaces

## Deployment state

The repository is ready for GitHub Pages deployment through GitHub Actions.

If the Pages workflow cannot create the site automatically, enable it once in GitHub:

`Settings → Pages → Build and deployment → Source: GitHub Actions`

Do not claim the public site is live until the Pages deployment is verified successfully.

## Not yet completed

- Semantic / vector search.
- AI recommendation engine.
- Favorites / personal collections.
- Automated metadata refresh.
- GitHub Stars / activity synchronization.
- Resource health checks.
- Backend database migration.
- Per-resource detail pages.

## Current rules

1. Do not duplicate existing resources.
2. Do not overwrite verified resource metadata without checking the source again.
3. A resource may belong to multiple categories.
4. Unknown values must remain `unknown` / `null`; do not guess.
5. `data/resources.json` is the V0.x resource authority.
6. Repository `main` is the project authority unless a later versioned governance rule changes this.
7. Add a new category when a real resource does not fit existing categories; do not force misleading classification.
8. Never publish credentials, secrets, API keys, tokens, private account IDs, temporary auth-flow URLs, or private dashboard links.
9. Prefer canonical public URLs for resources stored in the public catalog.

## Next step

Verify the first GitHub Pages deployment. After deployment is healthy, continue accepting user URLs and add the next batch without redesigning the established V0.2 architecture.
