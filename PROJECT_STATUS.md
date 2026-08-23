# Project Status

Status date: 2026-08-23 (Asia/Taipei)

## Project

- Name: Qookey AI Resource Hub
- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Current version: **V0.3 marketplace direction**
- GitHub Pages target: `https://qookey109-pixel.github.io/ai-resource-hub/`

## Completed

- Repository foundation and governance files established.
- Canonical V0.1 resource schema established.
- Canonical category catalog established.
- First two user-supplied resource batches ingested and reviewed.
- Catalog contains **13 resources**.
- Account-specific / temporary URLs are sanitized before publication.
- Search, category filter, type filter, free/open-source filters, sorting and quick-category navigation implemented.
- GitHub Pages deployment workflow added at `.github/workflows/pages.yml`.
- `.nojekyll` added for static-site publishing.
- V0.3 information architecture changed from a dark dashboard presentation to a clean resource-marketplace presentation.
- Current marketplace structure: sticky navigation, centered search hero, trending category chips, left filters, resource-card grid and supporting value section.
- Capafy is recorded only as a structural UX reference; exact branding, content, proprietary code and assets are not copied.
- Design direction is frozen in `docs/DESIGN_DIRECTION.md` so later visual refinements do not require rebuilding the information architecture.

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
- Final branding details such as colors, typography, card imagery and category icon system.

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
10. Preserve the V0.3 marketplace information architecture while iterating on visual details unless a later explicit design decision changes it.

## Next step

Verify the first GitHub Pages deployment, then continue ingesting user-supplied URLs and refine the marketplace visual details incrementally without rebuilding the established V0.3 structure.
