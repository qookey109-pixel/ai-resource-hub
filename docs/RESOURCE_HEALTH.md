# Resource Health V0.1

`Resource Health` is a non-destructive quality check for the public catalog.

It exists to detect stale URLs and metadata drift without silently changing verified resource records.

## Authority boundary

- `data/resources.json` remains the resource authority.
- The health report is observational evidence only.
- A redirect, GitHub metadata change, 404, archive flag, or license observation must be reviewed before any catalog field is changed.
- The workflow never deletes resources and never rewrites `data/resources.json`.

## What it checks

For every catalog entry:

1. Validates the catalog structure, required fields, duplicate IDs and absolute HTTP(S) URLs.
2. Tries the canonical resource URL with `HEAD`, falling back to `GET` when the server does not support `HEAD`.
3. Classifies URL results as:
   - `reachable`
   - `restricted` for 401 / 403 / 429 responses
   - `broken` for 404 / 410
   - `transient_error` for 5xx responses
   - `network_error` or `http_error` for other failures
4. Records redirects without automatically replacing the canonical URL.
5. For GitHub URLs, reads repository metadata through the GitHub API and records:
   - archived / disabled state
   - last push / update timestamps
   - Stars and Forks
   - detected SPDX license
6. Adds review observations when GitHub metadata conflicts with verified catalog metadata.

## Workflow

Workflow: `.github/workflows/resource-health.yml`

Triggers:

- manual `workflow_dispatch`
- weekly on Monday at `03:17 UTC`
- pushes to `main` that change the catalog, checker, or workflow
- pull requests that change the catalog, checker, or workflow

Pull requests run structural validation only so external website availability cannot make a PR flaky.

Scheduled, manual and relevant `main` pushes perform the full network check.

## Outputs

The full run creates:

- `reports/resource-health/resource-health.json`
- `reports/resource-health/resource-health.md`

Both are uploaded as a GitHub Actions artifact for 30 days. The Markdown report is also appended to the workflow summary.

External failures do not automatically fail the workflow. The report distinguishes likely broken resources from blocked, rate-limited and transient responses so maintainers can review evidence before changing the catalog.

## Local usage

Validate the catalog only:

```bash
python scripts/resource_health.py --validate-only
```

Run the full check:

```bash
python scripts/resource_health.py
```

Use a shorter or longer URL timeout when needed:

```bash
python scripts/resource_health.py --timeout 20
```

When `GITHUB_TOKEN` or `GH_TOKEN` is present, GitHub repository metadata requests use that token. No token is written to the report.

## V0.1 limitation

This version reports metadata drift but does not create automatic update PRs. That is deliberate: verified pricing, licensing, status and descriptions should not be overwritten solely because an automated endpoint returned different metadata.
