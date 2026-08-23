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
- Resource data model planned around JSON authority.
- Static searchable frontend foundation initialized.

## In progress

- Populate the first real resources supplied by the user.
- Validate categories and tags against real-world entries.
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

## Next step

Add and verify the first batch of user-supplied URLs, then deploy the static V0.1 site.
