# Project Status

Status date: 2026-08-23 (Asia/Taipei)

## Project

- Name: Qookey AI Resource Hub
- Repository: `qookey109-pixel/ai-resource-hub`
- Authority: GitHub `main`
- Current version: V0.1 foundation

## Completed

- Repository created and available on GitHub.
- Initial information architecture defined.
- Resource data model established around JSON authority.
- Static searchable frontend foundation initialized.
- First verified resource batch added: 5 resources.
- Real-world category validation started; `Audio / Music Production` added to avoid misclassifying non-AI audio resources.

## Current catalog

- Total resources: 5
- GitHub resources: 3
- Website resources: 2
- Current catalog authority: `data/resources.json`

## In progress

- Continue ingesting user-supplied resources with source verification and duplicate checks.
- Validate categories and tags against additional real-world entries.
- Prepare GitHub Pages deployment after the first content pass.

## Not yet completed

- AI recommendation engine.
- Favorites / personal collections.
- Automated metadata refresh.
- GitHub Stars / activity synchronization.
- Resource health checks.
- Backend database migration.

## Current rules

1. Do not duplicate existing resources.
2. Do not overwrite verified resource metadata without checking the source again.
3. A resource may belong to multiple categories.
4. Unknown values must remain `unknown`; do not guess.
5. `data/resources.json` is the V0.1 resource authority.
6. Repository `main` is the project authority unless a later versioned governance rule changes this.
7. Add a new category when a real resource does not fit existing categories; do not force misleading classification.

## Next step

Continue the verified ingestion workflow for user-supplied URLs, then deploy the static V0.1 site with GitHub Pages.
