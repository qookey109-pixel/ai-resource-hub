# Project Status

Status date: 2026-08-31 (Asia/Taipei)

## Project

- Name: Qookey AI Resource Hub
- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Current version: **V0.5 live AI recommendation + Resource Health V0.2 + V0.4.1 marketplace baseline + Resource Detail V1.3**
- GitHub Pages target: `https://qookey109-pixel.github.io/ai-resource-hub/`

## Completed

- Repository foundation and governance files established.
- Canonical V0.1 resource schema and category catalog established.
- Marketplace UX baseline established and preserved.
- Per-resource Detail V1 is implemented as a dependency-free responsive dialog opened from each resource card. It exposes the full summary, all use cases, pricing/open-source/license/difficulty/status/rating/date facts, all categories, tags, notes and the canonical external resource link without requiring AI or a backend.
- Resource Detail V1.1 adds an official/secondary-link section backed by `data/resource-links.json`. The canonical primary URL still comes from `data/resources.json`; the supplemental registry only adds verified project pages, documentation, demos, galleries, APIs or download links for an existing resource, so aliases do not become duplicate catalog cards.
- Resource Detail V1.2 removes the redundant `詳細資訊` button, makes the resource card itself the detail interaction surface, and enlarges the dedicated external `開啟 ↗` target while keeping favorite/external-link actions independent.
- Resource Detail V1.3 adds a native full-card detail hit target with dialog accessibility metadata, shareable `?resource=<id>` detail URLs, browser Back/Forward synchronization, a `複製連結` action, and automated Playwright browser regressions. Playwright is test-only; the production browsing runtime remains dependency-free.
- The official-links registry is initially seeded with Archify's Project Page, Scenario Guide and Proof Lab plus ABYSSAL's official GitHub Pages Live Demo.
- Browser-local favorites are implemented through `js/favorites.js` + `css/favorites.css`, including localStorage persistence, favorite-first ordering and recent-use ordering for favorited resources.
- Catalog now contains **42 verified resources**.
- Anime.js added as an active MIT-licensed JavaScript animation library resource.
- World Monitor added as an active AGPL-3.0-only global intelligence / OSINT dashboard resource with MCP, REST API, CLI and SDK access.
- Pi Agent Harness added as an active MIT-licensed AI agent toolkit with unified multi-provider LLM API, agent runtime, TUI and coding-agent CLI.
- MoneyPrinterTurbo added as an active MIT-licensed AI short-video automation toolkit with WebUI, API, CLI and AI Agent usage modes.
- reverse-skill added as an active MIT-licensed reverse-engineering / authorized-security-research Skill Router with scope gates, routing rules, regression tests and cross-platform workflows; bundled or external components may use other licenses.
- Mechanical Deployables for Three.js added as a 3D/WebGL mechanical deployment animation reference with 11 interactive models and a reusable model contract; no repository license is currently declared, so reuse rights remain unconfirmed.
- VoiceStudio added as an active-beta AGPL-3.0 local-first voice AI workstation covering voice cloning, voice design, dubbing, dictation, transcription, audiobooks, REST/OpenAI-compatible audio APIs and MCP.
- DSH Desktop added as an active MIT-licensed community Electron desktop distribution around the official DeepSeek Harness runtime/Web experience, with Profile Bundles, MCP, Git Worktree, attachments and controlled native capabilities. It is explicitly an independent community project rather than an official DeepSeek product.
- AI Website Cloner Template added as an active MIT-licensed AI Coding Agent workflow for reconstructing authorized websites into Next.js through reconnaissance, design-token extraction, component specs, parallel implementation and visual QA. Legal/brand reuse limits are explicitly recorded.
- ThreeUI Community added as an active MIT-licensed React / Three.js visual component library with 50 Community components, 111 Community routes, 164 browse results, npm distribution and a separate entitlement boundary for Pro source access.
- ElevenLabs added as an active freemium AI audio / voice platform covering TTS, STT, voice cloning, dubbing, music, voice/chat Agents and APIs, with plan-specific commercial and cloning rights recorded.
- Meshy AI added as an active freemium AI 3D platform covering Text-to-3D, Image-to-3D, AI texturing, rigging/animation, 3D Agent and API workflows, with current Free-plan download/licensing caveats recorded.
- Awesome Agent Skills added as an active MIT-licensed curated index with 1,497+ Agent Skills from official engineering teams and the community; linked third-party Skills retain their own licenses and terms.
- H3 Storyboard Skill added as an active MIT-licensed MiniMax H3 storyboard / performance Skill, with controlled-comparison evidence, explicit verified/partly-verified/inferred confidence labels and a complementary boundary with H3 prompt-syntax / ComfyUI setup Skills.
- MetalForge added as an active freemium browser shader editor for SwiftUI and supported React Native Skia effects, with free live editing/preview and a €5/month Pro export tier; commercial rights for exported content are recorded from the official site.
- vgpu added as an active MIT-licensed Vercel Labs WebGPU / WGSL TypeScript library with browser, Dawn-backed Node and deterministic mock runtimes plus Agent-ready CLI, llms.txt, examples API and MCP documentation.
- OpenExecutive added as an active Apache-2.0 virtual executive multi-agent system: one coherent Executive persona backed by eight specialist agents, company-document RAG, episodic memory, scheduling, web/API/CLI access and Slack/Email/Telegram/Google Chat/Discord integrations. The default Claude API path can be replaced or supplemented with OpenRouter or OpenAI-compatible local models.
- OpenStreetMap added as an active community-driven open geospatial data platform. Catalog metadata records ODbL-1.0 for map data, attribution/share-alike requirements, and the separate usage-policy boundary for official API, tile and Nominatim services.
- ABYSSAL — Natural Disasters added as an active MIT-licensed Three.js / WebGL2 cinematic ocean and extreme-weather simulation with multi-cascade FFT waves, volumetric clouds, hurricanes, tsunamis, waterspouts, GPU-generated runtime assets, adaptive quality and an official GitHub Pages live demo. Catalog notes explicitly distinguish it from scientific weather/disaster prediction and separate the optional community token disclosure from the software itself.
- Canonical 3D category authority remains `3D / WebGL` with category id `three-d-webgl`; the previously documented `3D / WebGL / Graphics` wording was stale status prose and is not a canonical category.
- Added a new `Maps / GIS` category with Traditional Chinese display name `地圖 / GIS` for mapping, geospatial data and GIS resources.
- All current user-facing resource descriptions, use cases and notes are Traditional Chinese.
- Frontend type / pricing / source-state labels are localized to Traditional Chinese.
- Category display names are localized to Traditional Chinese while stable internal category keys remain unchanged for data compatibility.
- Resource schema requires Traditional Chinese for future `summary`, `use_cases` and `notes` fields by default.
- Original Qookey mascot icon is wired as the site brand icon / SVG favicon.
- A dedicated per-resource icon registry exists at `data/resource-icons.json`.
- Resource cards prefer their own official-site favicon, project logo or project/owner image instead of sharing category icons.
- Higher-resolution icon sources are preferred. DSH Desktop uses its repository's official SVG app icon. AI Website Cloner Template currently falls back to the author's 256px GitHub avatar because no dedicated project logo was verified.
- ThreeUI Community uses the repository's official `public/threeui-mark.svg` project mark rather than a generic category icon or owner avatar.
- ElevenLabs and Meshy AI use resource-specific domain favicons rather than category icons.
- MetalForge uses its own domain favicon; vgpu uses the vgpu.sh documentation-domain favicon rather than a shared category icon.
- OpenExecutive currently uses the SenteLabsAI 256px GitHub organization avatar because no dedicated project logo/icon was found in the repository tree.
- OpenStreetMap uses its official domain favicon source; the provided Taipei-specific map viewport is intentionally normalized to the canonical public homepage in the catalog.
- ABYSSAL currently uses the Token-Gremlin 256px GitHub owner avatar as a resource-specific fallback; its official live demo is stored as a secondary link in `data/resource-links.json` instead of creating a duplicate catalog card.
- If an external resource icon cannot load, the frontend automatically falls back to the existing category icon so cards never render as broken images.
- Account-specific / temporary URLs continue to be sanitized before publication.
- Search, compact sticky search, category filtering, type filtering, free/open-source filters and sorting remain intact.
- GitHub Pages deployment workflow remains at `.github/workflows/pages.yml`; the Resource Detail V1.2 deployment (`33363526510`) completed successfully on 2026-08-31.
- Cloudflare AI recommender deployment is recorded as activated on 2026-08-23 after the deployment workflow passed Worker health and semantic recommendation checks.
- Resource Health V0.1 is implemented through `scripts/resource_health.py` and records raw catalog URL / GitHub metadata observations without mutating verified catalog data.
- Resource Health V0.2 adds `data/resource-health-expectations.json` plus `scripts/resource_health_triage.py` so known authentication, anti-bot, redirect and SPDX-label behavior can be classified as reviewed expected variance while raw evidence remains preserved.
- Resource Health V0.2 PR validation passed, and the first full V0.2 `main` run (`33312760577`) completed successfully on 2026-08-30: 39 total resources, 34 clean, 5 expected variances and **0 review-required** items. Raw counters remained 37 reachable, 2 restricted/rate-limited, 2 redirected, 0 broken 404/410 and 0 transient/network/other errors.
- The post-OpenExecutive full Resource Health V0.2 `main` run (`33313186974`) also completed successfully, including structural validation, URL/GitHub observation, reviewed triage and artifact upload.
- The post-OpenStreetMap full Resource Health V0.2 `main` run (`33313859565`) completed successfully, and its GitHub Pages deployment (`33313859569`) also completed successfully.
- The post-ABYSSAL full Resource Health V0.2 `main` run (`33315462209`) completed successfully, and its GitHub Pages deployment (`33315462214`) also completed successfully.
- The Resource Detail V1 GitHub Pages deployment (`33361678368`) completed successfully on 2026-08-31.
- The Resource Detail V1.2 GitHub Pages deployment (`33363526510`) completed successfully on 2026-08-31.
- The Resource Detail V1.3 GitHub Pages deployment (`33365202446`) completed successfully on 2026-08-31.
- The Resource Detail V1.3 main-branch Frontend Interaction Regression (`33365202433`) completed successfully on 2026-08-31, covering card detail opening, Escape/history closing, favorite/external-link isolation, direct Archify deep links and clipboard sharing.

## V0.5 AI recommendation

The large homepage task box has a live AI recommendation path in addition to instant keyword filtering.

Implemented:

- Frontend keeps instant keyword filtering while typing.
- Arrow / Enter can call an AI recommendation backend.
- AI response panel shows task interpretation, 3–5 recommended catalog resources, each resource's role/reason/how-to-use, stack plan and caveats.
- Recommended resource cards are shown in the catalog in AI recommendation order.
- Frontend validates recommendation IDs against the loaded catalog.
- Runtime endpoint configuration lives in `data/ai-config.json`.
- AI backend implementation lives in `worker/` and uses a Cloudflare Workers AI binding (`env.AI`).
- Backend loads the current public `data/resources.json` authority from GitHub `main` and asks the model to choose only from that catalog.
- Backend validates returned IDs against the catalog before responding.
- Backend includes a deterministic keyword/content fallback if model inference or JSON parsing fails.
- Backend accepts only the configured production origin plus localhost development origins.
- Task input is limited to 2–500 characters.
- No third-party AI API key is placed in frontend code or repository files.
- Deployment workflow lives at `.github/workflows/deploy-ai-worker.yml`.
- The workflow verifies Cloudflare credentials, deploys the Worker, checks `/health`, runs semantic recommendation regressions, then writes the frontend endpoint only after those checks pass.
- Deployment / activation instructions are documented in `docs/AI_BACKEND.md`.

Current activation state:

- `data/ai-config.json`: `enabled=true`
- Configured endpoint: `https://qookey-ai-resource-recommender.q-oo109.workers.dev/api/recommend`
- Activation commit: `d3f02fe6089589996003c8b5c4d943bcf6961517` (`Activate deployed AI recommender`, 2026-08-23).
- The activation workflow passed Worker health and three semantic recommendation regression checks before enabling the frontend endpoint.
- Repository deployment evidence remains the current authority for activation state.

## Resource Health V0.2

The catalog has a non-destructive recurring health + reviewed-triage layer.

Behavior:

- Pull requests that touch the catalog/checker/policy/workflow run structural validation only.
- Relevant `main` pushes, manual dispatches and the weekly Monday `03:17 UTC` schedule run the full URL/GitHub metadata check and reviewed triage.
- Raw and reviewed reports are uploaded as 30-day GitHub Actions artifacts and summarized in the workflow UI.
- 401 / 403 / 429 remain raw `restricted` observations rather than being automatically labeled broken.
- 404 / 410 are flagged as broken.
- Reviewed expectations can classify known auth/anti-bot/redirect/SPDX behavior as `expected-variance` while preserving raw evidence.
- Verified pricing, licensing, status, descriptions and canonical URLs remain unchanged until reviewed.

First V0.2 full-run evidence:

- Workflow run: `33312760577`
- Commit: `c903f9c8f37046084ff919246281209619cbb4bf`
- Result: PASS
- Clean: 34
- Expected variance: 5
- Review required: 0
- Broken resources: 0
- Automatic catalog mutations: 0

## Current catalog

- Total resources: 42
- Resource authority: `data/resources.json`
- Category authority: `data/categories.json`
- Resource icon authority: `data/resource-icons.json`
- Secondary official-link registry: `data/resource-links.json`
- Resource-health review policy: `data/resource-health-expectations.json`
- AI runtime config: `data/ai-config.json`
- Multi-category classification is enabled.
- Unknown metadata remains `unknown` / `null` instead of being guessed.
- Technical tags may remain English for searchability, while user-facing explanatory copy is Traditional Chinese.

## Pending ingestion

- Threads post `@cyesuta.lee / DcWAmV-iScT`: content could not be reliably fetched or verified from the supplied media URL, so it has **not** been added to the catalog. A screenshot, post text, or the underlying resource URL is required before classification.
- Short URL `https://dub.sh/hz9kTZ5` is not yet cataloged because its canonical destination could not be reliably resolved; a stable destination URL should be verified before ingestion.

## Deployment state

- GitHub Pages is deployed through `.github/workflows/pages.yml`; the latest confirmed deployment is Resource Detail V1.3 run `33365202446`, completed successfully on 2026-08-31.
- Browser interaction regression CI is defined at `.github/workflows/frontend-interaction.yml`; the latest confirmed main run is `33365202433`, completed successfully on 2026-08-31. Playwright remains test-only and is not shipped in the production frontend.
- Cloudflare Worker deployment is managed separately through `.github/workflows/deploy-ai-worker.yml`.
- The Worker is configured and activated in `data/ai-config.json` with the production `/api/recommend` endpoint.
- Future Worker code changes require the existing Cloudflare deployment credentials in GitHub Secrets; credentials must never be written into repository files.
- The Worker reads the current public `data/resources.json` authority from GitHub `main`, so catalog-only additions do not require a Worker code redeploy.

## Not yet completed

- Automated recurring production Worker health / semantic regression monitoring.
- Semantic / vector search for larger catalogs.
- Account/cloud-synced personal collections beyond the current browser-local favorites.
- Automated metadata refresh PR generation; Resource Health V0.2 classifies observations but still does not modify verified catalog data.
- GitHub Stars / activity synchronization into verified catalog metadata; Resource Health observes current values in artifacts only.
- Backend database migration.
- Dedicated path-based standalone per-resource routes/pages beyond the current query-parameter detail deep links.
- Wider verified official-link coverage across the catalog beyond the initially seeded resources.
- Search indexing for `data/resource-links.json` labels/descriptions such as Scenario Guide, Proof Lab and Live Demo.
- Local cached copies of every third-party resource icon.
- Final typography and exact accent palette.

## Current rules

1. Do not duplicate existing resources.
2. Do not overwrite verified resource metadata without checking the source again.
3. A resource may belong to multiple categories.
4. Unknown values must remain `unknown` / `null`; do not guess.
5. `data/resources.json` is the V0.x resource identity and canonical-primary-URL authority.
6. `data/resource-links.json` may only add verified secondary public links for an existing resource; it must not create aliases as new resources or override the canonical primary URL.
7. Repository `main` is the project authority unless a later versioned governance rule changes this.
8. Add a new category when a real resource does not fit existing categories; do not force misleading classification.
9. Never publish credentials, secrets, API keys, tokens, private account IDs, temporary auth-flow URLs, or private dashboard links.
10. Prefer canonical public URLs for resources stored in the public catalog and stable official URLs for secondary links.
11. Preserve the V0.4 marketplace structure while iterating on visual details unless a later explicit design decision changes it.
12. User-facing `summary`, `use_cases`, `notes` and secondary-link descriptions must be Traditional Chinese by default.
13. External visual references may guide layout or design principles, but do not copy proprietary code, branding, characters or assets.
14. Resource cards should prefer resource-specific official icons; category icons are fallback only.
15. A public repository without an explicit license must not be described as freely reusable or commercially usable; preserve license as unknown until verified.
16. AI recommendation output may only refer to resources present in the current catalog; validate IDs server-side and client-side.
17. AI backend deployment secrets must stay in Cloudflare or GitHub Secrets, never in public frontend files.
18. Website reconstruction / cloning resources must be described for authorized migration, recovery, learning or other lawful use; do not present copying third-party branding, protected assets or deceptive impersonation as acceptable use.
19. Resource Health output is evidence for review, not automatic authority. External availability or GitHub metadata alone must not silently overwrite verified catalog records.
20. Resource detail share URLs must use stable catalog resource IDs and must not create a second resource identity or override the canonical external URL.

## Next step

Proceed with V1.4 discovery improvements: expand verified official-link coverage, include `data/resource-links.json` labels/descriptions in search, improve icon reliability, and continue production AI recommender monitoring while ingesting verified user-supplied resources in parallel.
