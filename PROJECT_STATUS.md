# Project Status

Status date: 2026-08-23 (Asia/Taipei)

## Project

- Name: Qookey AI Resource Hub
- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Current version: **V0.5 AI recommendation scaffold + V0.4.1 marketplace baseline**
- GitHub Pages target: `https://qookey109-pixel.github.io/ai-resource-hub/`

## Completed

- Repository foundation and governance files established.
- Canonical V0.1 resource schema and category catalog established.
- Marketplace UX baseline established and preserved.
- Catalog now contains **25 verified resources**.
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
- Added a new `3D / WebGL / Graphics` category with Traditional Chinese display name `3D / WebGL / 圖形` instead of forcing 3D resources into unrelated categories.
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
- If an external resource icon cannot load, the frontend automatically falls back to the existing category icon so cards never render as broken images.
- Account-specific / temporary URLs continue to be sanitized before publication.
- Search, compact sticky search, category filtering, type filtering, free/open-source filters and sorting remain intact.
- GitHub Pages deployment workflow remains at `.github/workflows/pages.yml`.

## V0.5 AI recommendation scaffold

The large homepage task box now has a real AI recommendation path instead of being only decorative search UI.

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
- Manual deployment workflow added at `.github/workflows/deploy-ai-worker.yml`.
- Deployment / activation instructions documented in `docs/AI_BACKEND.md`.

Current activation state:

- `data/ai-config.json`: `enabled=false`
- Worker code is ready but **Cloudflare deployment URL is not yet configured**.
- Until activation, keyword search remains fully functional; explicitly requesting AI shows a clear backend-not-enabled message rather than failing silently.

## Current catalog

- Total resources: 25
- Resource authority: `data/resources.json`
- Category authority: `data/categories.json`
- Resource icon authority: `data/resource-icons.json`
- AI runtime config: `data/ai-config.json`
- Multi-category classification is enabled.
- Unknown metadata remains `unknown` / `null` instead of being guessed.
- Technical tags may remain English for searchability, while user-facing explanatory copy is Traditional Chinese.

## Pending ingestion

- Threads post `@cyesuta.lee / DcWAmV-iScT`: content could not be reliably fetched or verified from the supplied media URL, so it has **not** been added to the catalog. A screenshot, post text, or the underlying resource URL is required before classification.

## Deployment state

The static repository is ready for GitHub Pages deployment through GitHub Actions.

If the Pages workflow cannot create the site automatically, enable it once in GitHub:

`Settings → Pages → Build and deployment → Source: GitHub Actions`

The AI Worker is separate from GitHub Pages and still needs Cloudflare deployment. The manual workflow requires repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, or it can be deployed locally with Wrangler. After deployment, put the final `/api/recommend` URL in `data/ai-config.json` and set `enabled=true`.

Do not claim AI recommendations are live until the Worker endpoint is deployed, configured and verified successfully.

## Not yet completed

- Cloudflare Worker deployment / live AI endpoint activation.
- End-to-end production AI recommendation smoke test.
- Semantic / vector search for larger catalogs.
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
14. A public repository without an explicit license must not be described as freely reusable or commercially usable; preserve license as unknown until verified.
15. AI recommendation output may only refer to resources present in the current catalog; validate IDs server-side and client-side.
16. AI backend deployment secrets must stay in Cloudflare or GitHub Secrets, never in public frontend files.
17. Website reconstruction / cloning resources must be described for authorized migration, recovery, learning or other lawful use; do not present copying third-party branding, protected assets or deceptive impersonation as acceptable use.

## Next step

Deploy the prepared Cloudflare Worker, capture its public `/api/recommend` endpoint, enable it in `data/ai-config.json`, then run an end-to-end production test using task prompts such as `我要做 LINE AI 客服`, `我要做 AI 短影片`, and `我要做 Three.js 3D 遊戲效果`. Continue ingesting verified user-supplied resources in parallel.
