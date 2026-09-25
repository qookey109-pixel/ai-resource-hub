# AGENTS.md

Rules for AI coding agents and maintainers.

## Authority

1. Re-read latest GitHub `main` before making changes.
2. Read `PROJECT_STATUS.md` for the current baseline.
3. Treat `data/resources.json` as resource identity + canonical URL authority.
4. Treat `data/resource-links.json` as supplemental only.
5. Do not recreate completed work or replace verified facts without newer evidence.
6. The product is in maintenance mode: prefer focused fixes and selective high-value resources over breadth-driven feature expansion.

## Resource changes

- Verify canonical identity and URL.
- Check duplicate URL / alias before adding.
- Use existing categories unless a genuinely new category is required.
- Keep tags lower-case.
- Use verified pricing / license / status; otherwise use schema-approved unknown values.
- User-facing summaries, use cases, notes and link descriptions should be Traditional Chinese by default.
- Add official docs / demos / API / downloads to `resource-links.json` instead of creating duplicate cards.
- Never publish credentials, tokens, signed URLs, private dashboard state or temporary auth URLs.
- Follow `docs/CATALOG.md`.

## Frontend

- Keep normal browsing dependency-free.
- Keep production CSS consolidated in `css/styles.css`.
- Prefer editing existing modules over adding one-off patch files.
- Keep Pages allowlisted to browser-required files; never publish the repository root.
- Supplemental registry failure must not prevent the canonical catalog from loading.
- Stable resource deep links must use resource IDs, not display names.
- Changes affecting cards, search, favorites, external links, detail dialogs, keyboard behavior, history or icons must pass `npm run test:browser`.

## Workers and operations

- Keep AI and click Workers separate from catalog identity.
- Preserve the lightweight System-1 router before model inference for short ambiguous requests; already-specific requests should pass through without unnecessary clarification.
- Do not embed heavyweight Python / Torch model runtimes into the Cloudflare Worker without an explicit architecture change and deployment-cost review.
- AI recommendations may rank catalog resources but must not invent catalog IDs or write catalog metadata.
- Production monitoring must not increment click counts.
- Worker deploys need bounded health / semantic checks.
- Follow `docs/OPERATIONS.md`.

## Safety

Do not expose secrets in source, logs, artifacts, catalog data or documentation.
