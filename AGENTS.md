# AGENTS.md

Instructions for AI coding agents and maintainers working on this repository.

## Authority

- Read `PROJECT_STATUS.md` before changing the project.
- Treat GitHub `main` as the current project authority.
- Treat `data/resources.json` as the V0.1 resource-data authority.
- Do not recreate completed work or replace verified data without source evidence.

## Resource ingestion rules

For every new URL:

1. Verify the canonical URL and resource identity.
2. Determine whether the resource is a website, GitHub repository, documentation, model, service, library, dataset, or other supported type.
3. Search existing entries for duplicates or aliases.
4. Use only categories from `data/categories.json` unless a genuinely new category is needed.
5. Add useful lower-case tags for retrieval.
6. Record pricing/open-source/license/status only when verified; otherwise use `unknown` or `null` as defined by the schema.
7. Keep summaries factual and concise.
8. Record `last_checked` using an ISO date.
9. Validate JSON after every data change.

## Frontend rules

- Keep V0.1 dependency-free unless there is a clear benefit to adding a dependency.
- Preserve mobile and desktop usability.
- Search must work across name, summary, categories, tags, and use cases.
- Never require AI or a backend just to browse the resource catalog.

## Future recommendation layer

Recommendation logic should consume the same structured resource data rather than creating a second source of truth. Ranking or AI-generated recommendations must remain distinguishable from verified source metadata.
