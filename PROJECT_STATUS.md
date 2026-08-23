# Project Status

Status date: 2026-08-23 (Asia/Taipei)

## Project

- Name: Qookey AI Resource Hub
- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Current version: **V0.4.1 marketplace content + branding baseline**
- GitHub Pages target: `https://qookey109-pixel.github.io/ai-resource-hub/`

## Completed

- Repository foundation and governance files established.
- Canonical V0.1 resource schema and category catalog established.
- Marketplace UX baseline established and preserved.
- Catalog now contains **14 verified resources**.
- Anime.js added as an active MIT-licensed JavaScript animation library resource.
- All current user-facing resource descriptions, use cases and notes were converted to Traditional Chinese.
- Frontend type / pricing / source-state labels were localized to Traditional Chinese.
- Category display names are localized to Traditional Chinese while stable internal category keys remain unchanged for data compatibility.
- Resource schema now requires Traditional Chinese for future `summary`, `use_cases` and `notes` fields by default.
- Original Qookey mascot icon added and wired as the site brand icon / SVG favicon.
- A dedicated per-resource icon registry now exists at `data/resource-icons.json`.
- The current 14 resource cards now prefer their own official-site favicon or project/owner image instead of sharing category icons.
- If an external resource icon cannot load, the frontend automatically falls back to the existing category icon so cards never render as broken images.
- Account-specific / temporary URLs continue to be sanitized before publication.
- Search, compact sticky search, category filtering, type filtering, free/open-source filters and sorting remain intact.
- GitHub Pages deployment workflow remains at `.github/workflows/pages.yml`.

## Current catalog

- Total resources: 14
- Resource authority: `data/resources.json`
- Category authority: `data/categories.json`
- Resource icon authority: `data/resource-icons.json`
- Multi-category classification is enabled.
- Unknown metadata remains `unknown` / `null` instead of being guessed.
- Technical tags may remain English for searchability, while user-facing explanatory copy is Traditional Chinese.

## Pending ingestion

- Threads post `@cyesuta.lee / DcWAmV-iScT`: content could not be reliably fetched or verified from the supplied media URL, so it has **not** been added to the catalog. A screenshot, post text, or the underlying resource URL is required before classification.

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
- Local cached copies of every third-party resource icon.
- Final typography and exact accent palette.

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
10. Preserve the V0.4 marketplace structure while iterating on visual details unless a later explicit design decision changes it.
11. User-facing `summary`, `use_cases` and `notes` must be Traditional Chinese by default.
12. External visual references may guide layout or design principles, but do not copy proprietary code, branding, characters or assets.
13. Resource cards should prefer resource-specific official icons; category icons are fallback only.

## Next step

Continue ingesting verified user-supplied URLs. For each new resource, add or verify an independent resource icon alongside the Chinese description and classification without rebuilding the current marketplace structure.
