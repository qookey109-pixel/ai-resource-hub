# AGENTS.md

Instructions for AI coding agents and maintainers working on this repository.

## Authority

- Read `PROJECT_STATUS.md` before changing the project.
- Treat GitHub `main` as the current project authority.
- Treat `data/resources.json` as the V0.1 resource-data authority for resource identity and canonical primary URLs.
- Treat `data/resource-links.json` only as a supplemental registry for verified secondary public links; it must not create duplicate resources or override canonical identity.
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
10. If a resource already exists and the new URL is an official project page, documentation page, demo, gallery, API or download page for that same resource, prefer adding it to `data/resource-links.json` instead of creating another catalog entry.

## Frontend rules

- Keep V0.x browsing and detail views dependency-free unless there is a clear benefit to adding a dependency.
- Preserve mobile and desktop usability.
- Search must work across name, summary, categories, tags, and use cases.
- Never require AI or a backend just to browse the resource catalog.
- Resource Detail may read supplemental registries such as icons and official links, but `data/resources.json` remains the identity and canonical-primary-URL authority.

## Future recommendation layer

Recommendation logic should consume the same structured resource data rather than creating a second source of truth. Ranking or AI-generated recommendations must remain distinguishable from verified source metadata.
