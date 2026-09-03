# Project Status

Status date: 2026-09-03 (Asia/Taipei)

## Project

- Name: Qookey AI Resource Hub
- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Website: `https://qookey109-pixel.github.io/ai-resource-hub/`
- Current product baseline: **V0.5 live AI recommendation + Resource Health V0.2 + Resource Detail V1.3 + Discovery V1.4 + Icon Reliability V1 + shared interaction counts + search-side date/click sorting + production Worker monitoring + status consistency CI**
- Current canonical catalog size: **65 resources**

Repository `main` and the canonical data files below are authoritative. Historical commit/run details remain available in Git history and GitHub Actions; this file is intentionally maintained as the concise current operating baseline rather than an exhaustive changelog.

## Canonical authorities

- Resource identity + canonical primary URLs: `data/resources.json`
- Categories: `data/categories.json`
- Resource icons: `data/resource-icons.json`
- Verified supplemental official links: `data/resource-links.json`
- Resource-health reviewed expectations: `data/resource-health-expectations.json`
- AI recommender runtime config: `data/ai-config.json`
- Shared interaction-counter frontend config: `data/click-config.json`
- AI backend source: `worker/`
- Shared interaction-counter backend: `worker-clicks/`

## Current completed capabilities

### Catalog and discovery

- 65 canonical resources are currently present in `data/resources.json`.
- Multi-category classification is enabled.
- User-facing summaries, use cases, notes and supplemental-link descriptions are Traditional Chinese by default.
- Unknown pricing/license/status fields remain `unknown` / `null` instead of being guessed.
- Search covers names, summaries, categories, tags, use cases, notes, pricing and verified supplemental-link metadata.
- Discovery V1.4 indexes verified supplemental-link labels/descriptions/kinds/stable URL components while always resolving back to the existing parent resource ID.
- Account-specific, temporary login-flow and tracking URLs are normalized to stable public canonical URLs before publication.
- Duplicate URLs/aliases must be checked against the canonical catalog immediately before every write.

### Resource detail and navigation

- Resource Detail V1.3 is live as a dependency-free responsive dialog.
- The whole card is the accessible detail hit target while favorite and outbound-link actions remain independent.
- Stable detail deep links use `?resource=<id>`.
- Browser Back/Forward synchronizes with detail state.
- Detail view supports `複製連結`.
- Verified documentation, demos, APIs, downloads, galleries and project pages are attached through `data/resource-links.json`; they never become duplicate resources merely because they are separate official URLs.

### Sorting and shared interaction counts

- Search-side sort controls support added date and shared interaction counts.
- Default order is added date: newest first.
- Each sort family remembers its last direction.
- Shared click data is stored through the Cloudflare Durable Object counter configured by `data/click-config.json`.
- Opening a resource detail card records +1 interaction.
- Following an outbound canonical/official resource link records a separate +1 interaction.
- A detail open followed by an outbound click therefore records two separate interactions by design.
- Direct `?resource=<id>` opening and browser-history reopening are not counted unless the user performs the actual card/link interaction.
- These counts are aggregate interactions, not unique visitors, and existing count data must not be reset by UI/catalog changes.

### AI recommendation

- Live AI recommendation remains enabled through `data/ai-config.json`.
- Production endpoint: `https://qookey-ai-resource-recommender.q-oo109.workers.dev/api/recommend`
- Backend loads the public current catalog authority and can only return resource IDs present in that catalog.
- Client and server both validate IDs.
- Deterministic keyword/content fallback remains available if model inference or response parsing fails.
- Browsing/searching the catalog never requires the AI backend.

### Resource Health

- Resource Health V0.2 is non-destructive.
- It observes canonical URLs and GitHub metadata, uploads evidence, and applies reviewed expected-variance rules.
- 401/403/429 are observations, not automatically treated as broken resources.
- 404/410 are flagged as broken.
- External observations do not silently modify verified pricing, license, summary, status, canonical URL or resource identity.
- The refreshed 65-resource baseline was captured by GitHub Actions run `33762653338` against catalog authority `f28d1394ea558d76c64faedc19984c97dacb43b6`; the temporary workflow was the only branch-only file.
- Baseline raw triage: **59 clean, 4 expected variances, 2 review required, 0 broken (404/410)**. Evidence artifact: `resource-health-65-baseline-33762653338`, SHA-256 `ea73b238facf10e85ac146f7f0a7c15c26e891c62b2666e28ace589d10066efd`.
- `groqcloud-console` root → `/home` normalization has now been reviewed as an expected redirect while keeping the shorter stable console root as canonical.
- `mistral-studio` remains review-required because one unauthenticated probe reached Mistral's generated login flow and ended in HTTP 500. Do not whitelist generic 500 responses or change the canonical URL from this single transient observation.

### Icons

- Resource cards prefer resource-specific official marks/favicons/verified owner or organization images.
- Icon Reliability V1 provides runtime fallback when a third-party icon fails.
- Category icons remain the last fallback, not the preferred resource identity.
- Do not replace an existing verified icon merely for novelty; upgrade only when a clearly better stable official project asset is verified.

### Testing, monitoring and deployment

- Production frontend remains dependency-free.
- Playwright is test-only and covers resource-detail interactions, favorites/external-link separation, history/deep links, supplemental-link search and shared detail-click counting.
- GitHub Pages deployment remains managed by `.github/workflows/pages.yml`.
- Frontend regressions remain managed by `.github/workflows/frontend-interaction.yml`.
- Resource Health remains managed by its existing workflow and scripts.
- `scripts/project_status_consistency.py` + `.github/workflows/project-status-consistency.yml` verify that the status catalog count matches `data/resources.json` and that the status date is not older than canonical data updates.
- `scripts/production_worker_monitor.py` + `.github/workflows/production-worker-monitor.yml` provide recurring production checks. The scheduled run is daily at `02:43 UTC` (`10:43 Asia/Taipei`) and can also be dispatched manually.
- Production monitoring checks both Worker `/health` endpoints, performs a real semantic AI recommendation regression against the live current catalog, validates returned IDs against catalog authority, and reads the shared click API with GET only.
- Production monitoring never POSTs a synthetic click and therefore must never increment or reset shared interaction counts.
- Cloudflare AI recommender deployment remains separate from catalog-only changes.
- Catalog-only additions do not require an AI Worker redeploy because the recommender reads the current public catalog authority.

## Recent verified ingestion / refresh baseline

The following current resources were added or refreshed after the older 50-resource status snapshot and must not be duplicated:

- NESA-SLIDE
- Reverify
- Lieflat Charts
- Addy's Agent Skills
- BAML
- GetLayers
- Curated
- 60fps
- Graft
- Agency Agents
- Codebase Memory MCP
- OpenMontage
- Agent Reach
- Orca
- Skills For Real Engineers (`mattpocock/skills`) — **existing resource refreshed in place; original `added_at=2026-08-26` preserved**

`mattpocock/skills` is a particularly important duplicate-prevention example: repository search may fail to surface a minified JSON entry, so the canonical catalog itself must be read/checked before concluding a resource is absent.

## Recent verified maintenance baseline

- **Official Links Batch 6** is complete on `main`; links were materialized by commit `0569cee962b089b16aacda22c9bc5819e21fe91b`, and the temporary ingestion workflow was removed by `f28d1394ea558d76c64faedc19984c97dacb43b6`.
- The 65-resource Resource Health baseline run `33762653338` completed successfully with no broken 404/410 resources.
- Project-status consistency CI is now part of the maintained workflow set so resource-count/date drift is caught before being treated as current authority.
- Production Worker monitoring is now part of the maintained workflow set; click-counter monitoring remains strictly read-only.

## Pending ingestion

- Threads post `@cyesuta.lee / DcWAmV-iScT`: not cataloged because the supplied media URL could not be reliably verified; a screenshot, post text or underlying resource URL is still required.
- `https://dub.sh/hz9kTZ5`: not cataloged because the stable canonical destination has not been reliably verified.

## Not yet completed

- Wider verified official-link coverage across resources that still have clearly verifiable official docs/demo/release/Skill entry points.
- Semantic/vector search if catalog size eventually makes current structured search insufficient.
- Automated metadata-refresh PR generation; Resource Health remains evidence-only today.
- GitHub Stars/activity synchronization into verified catalog metadata.
- Account/cloud-synced personal collections beyond browser-local favorites.
- Backend database migration if/when static JSON + current Workers cease to be sufficient.
- Dedicated path-based standalone resource routes beyond current query-parameter detail deep links.
- Local cached copies of every third-party icon.
- Targeted replacement of remaining low-resolution/generic icon sources when a better verified official mark exists.
- Final typography/accent-palette refinement.

## Current rules

1. Do not duplicate an existing resource.
2. Re-read GitHub `main` and check `data/resources.json` immediately before every ingestion write; do not rely only on code search or an older chat/status snapshot.
3. Do not overwrite verified resource metadata without newer source evidence.
4. `data/resources.json` is the V0.x resource identity and canonical-primary-URL authority.
5. `data/resource-links.json` may add verified supplemental public links only; it cannot create aliases as new resource identities or override the canonical primary URL.
6. A resource may belong to multiple existing categories; add a new category only when the resource genuinely does not fit.
7. Unknown values remain `unknown` / `null`; do not guess.
8. User-facing `summary`, `use_cases`, `notes` and supplemental-link descriptions default to Traditional Chinese.
9. Never publish credentials, API keys, tokens, private account IDs, temporary auth-flow URLs or private dashboard links.
10. Preserve the current marketplace/card/detail architecture unless an explicit design decision changes it.
11. Resource cards prefer verified resource-specific icons; category icons are fallback only.
12. Public GitHub repositories without an explicit verified license must not be described as freely reusable or commercially usable.
13. AI recommendations may only reference current catalog IDs and remain distinguishable from verified source metadata.
14. Resource Health is evidence for review, not automatic catalog authority.
15. Website reconstruction/cloning resources must be framed for authorized migration, recovery, learning or other lawful use, not deceptive impersonation or unauthorized brand copying.
16. Shared interaction counts are aggregate behavior signals, not unique-user analytics; UI changes must preserve existing counter data and counting semantics.
17. Frontend interaction/discovery changes must pass the existing browser regression suite before being treated as complete.
18. Production click-counter monitoring is GET-only. Synthetic monitoring must never POST a click or mutate production interaction counts.

## Next step

Proceed with **Official Links Batch 7** across existing resources that still have clearly verifiable official documentation, demos, release pages or Skill entry points. Before adding any supplemental link, confirm that it belongs to the same canonical resource ID and is not a separate product. Keep icon-quality work opportunistic only. Keep `mistral-studio` under review until a later health observation confirms the transient login-flow HTTP 500 has cleared; do not broaden the expected-variance policy to generic server errors.
