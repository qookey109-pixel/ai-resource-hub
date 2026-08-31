# Qookey AI Resource Hub

A curated AI and developer resource library for collecting, classifying, searching, and recommending useful websites, GitHub projects, Agent Skills, design references, cloud tools, databases, audio resources, and developer platforms.

## Website

GitHub Pages target:

`https://qookey109-pixel.github.io/ai-resource-hub/`

The repository includes a GitHub Actions Pages workflow at `.github/workflows/pages.yml`. GitHub Pages must be enabled with **Settings → Pages → Build and deployment → Source: GitHub Actions** before the first deployment can succeed.

## Current version

**V0.5 — live AI recommendation + Resource Health V0.2 + Resource Detail V1.3**

Current capabilities:

- Static GitHub Pages-ready marketplace website
- Search across names, descriptions, tags, use cases, notes, pricing, and categories
- Category and resource-type filters
- Free/open-source filters
- Recommendation, newest, and name sorting
- Popular-category shortcuts
- Browser-local favorites with favorite-first ordering
- Responsive per-resource detail dialog opened from the whole resource card
- Native accessible card hit target with dialog metadata and keyboard behavior
- Shareable resource-detail URLs using stable `?resource=<id>` query parameters
- Browser Back/Forward synchronization for detail views
- One-click `複製連結` action inside the detail dialog
- Full resource facts, use cases, categories, tags, notes and canonical external link
- Verified official/secondary links such as project pages, documentation, live demos and galleries
- Resource/category/open-source statistics
- Live AI recommendation backed by the same public catalog authority
- Resource Health V0.2 non-destructive URL/GitHub observation and reviewed triage
- Playwright browser interaction regressions in CI; Playwright is test-only and is not shipped in the production frontend
- Responsive desktop/mobile layout
- Public-link sanitization for account-specific or temporary dashboard/login URLs

## Data authority

`data/resources.json` is the canonical V0.x resource catalog and remains the authority for resource identity and primary URLs.

`data/categories.json` is the canonical category list.

`data/resource-icons.json` is the resource-specific icon registry.

`data/resource-links.json` is a supplemental registry for verified secondary public links. It does not create new resources or override the canonical primary URL.

Repository `main` is the project authority unless a later versioned governance rule changes this.

## Ingestion rule

Before adding a resource:

1. Verify what the resource actually does.
2. Check for duplicate URLs, aliases, and duplicate projects.
3. Verify factual metadata where practical.
4. Never publish credentials, API keys, tokens, account IDs, temporary login flows, or private dashboard URLs.
5. Prefer a public canonical URL when the supplied URL contains account-specific navigation state.
6. Use `unknown` / `null` instead of guessing.
7. Keep existing verified resource metadata unless newer source evidence justifies an update.
8. Store extra official pages, demos, docs or galleries in `data/resource-links.json` instead of creating duplicate catalog cards.

## Project structure

```text
.
├── .github/workflows/
│   └── frontend-interaction.yml
├── .nojekyll
├── AGENTS.md
├── PROJECT_STATUS.md
├── README.md
├── index.html
├── package.json
├── playwright.config.js
├── css/
│   ├── styles.css
│   ├── resource-detail.css
│   └── resource-links.css
├── js/
│   ├── app.js
│   ├── favorites.js
│   ├── resource-detail.js
│   └── resource-links.js
├── data/
│   ├── ai-config.json
│   ├── categories.json
│   ├── resource-health-expectations.json
│   ├── resource-icons.json
│   ├── resource-links.json
│   └── resources.json
├── tests/
│   └── resource-detail.spec.js
└── docs/
    ├── RESOURCE_LINKS.md
    └── RESOURCE_SCHEMA.md
```

## Browser regression tests

The production website remains dependency-free. The repository uses Playwright only as a development/CI dependency for critical interaction regressions:

```bash
npm install
npx playwright install chromium
npm run test:browser
```

The tests cover card-to-detail interaction, favorite/external-link separation, deep-link opening, Back-button closing and resource-link copying.

## Roadmap

- Expand verified official-link coverage across more catalog resources
- Include `data/resource-links.json` labels/descriptions in search discovery
- Improve local icon reliability for verified third-party icons
- Automated recurring production Worker health / semantic regression monitoring
- Semantic / vector search for larger catalogs
- Automated metadata refresh PR generation
- Account/cloud-synced collections beyond browser-local favorites
- Dedicated path-based per-resource pages only if query-parameter deep links later become insufficient
