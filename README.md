# Qookey AI Resource Hub

A curated AI and developer resource library for collecting, classifying, searching, and later recommending useful websites, GitHub projects, Agent Skills, design references, cloud tools, databases, audio resources, and developer platforms.

## Website

GitHub Pages target:

`https://qookey109-pixel.github.io/ai-resource-hub/`

The repository includes a GitHub Actions Pages workflow at `.github/workflows/pages.yml`. GitHub Pages must be enabled with **Settings → Pages → Build and deployment → Source: GitHub Actions** before the first deployment can succeed.

## Current version

**V0.2 — searchable resource website**

Current capabilities:

- Static GitHub Pages-ready website
- Search across names, descriptions, tags, use cases, notes, pricing, and categories
- Category and resource-type filters
- Free/open-source filters
- Recommendation, newest, and name sorting
- Popular-category shortcuts
- Resource/category/open-source statistics
- Responsive desktop/mobile layout
- JSON-based catalog authority
- Public-link sanitization for account-specific or temporary dashboard/login URLs

## Data authority

`data/resources.json` is the canonical V0.x resource catalog.

`data/categories.json` is the canonical category list.

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

## Project structure

```text
.
├── .github/workflows/pages.yml
├── .nojekyll
├── AGENTS.md
├── PROJECT_STATUS.md
├── README.md
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── data/
│   ├── categories.json
│   └── resources.json
└── docs/
    └── RESOURCE_SCHEMA.md
```

## Roadmap

- V0.3: resource detail views and stronger discovery UX
- V0.4: favorites / collections
- V0.5: automated health and metadata checks
- Later: semantic search and AI recommendations based on the curated catalog
