# Resource Health V0.2

`Resource Health` is a non-destructive quality check and review layer for the public catalog.

It exists to detect stale URLs and metadata drift without silently changing verified resource records, while also separating real review items from known authentication, anti-bot, redirect and metadata-format behavior.

## Authority boundary

- `data/resources.json` remains the resource authority.
- Raw health observations are evidence only.
- `data/resource-health-expectations.json` is a review-policy layer, not resource metadata authority.
- A redirect, GitHub metadata change, 404, archive flag, or license observation must still be reviewed before any catalog field is changed.
- The workflow never deletes resources and never rewrites `data/resources.json`.

## V0.1 raw observer

`scripts/resource_health.py` performs the raw observation pass.

For every catalog entry it:

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
6. Adds metadata observations when GitHub metadata differs from verified catalog metadata.

Raw output is intentionally policy-neutral. A 403 from an authenticated dashboard, for example, remains a raw `restricted` observation even when it is expected.

## V0.2 reviewed triage

`scripts/resource_health_triage.py` applies reviewed expectations from `data/resource-health-expectations.json` to the raw report.

It classifies every resource as one of:

- `clean` — no raw condition requiring interpretation.
- `expected-variance` — the raw condition matches a reviewed rule and is retained as evidence without creating a review item.
- `review-required` — the raw condition is not covered by a reviewed expectation and needs human inspection.

Current reviewed expectations include:

- Cloudflare Dashboard may return 403 to automated probes because it is an authenticated / anti-bot surface.
- xorxor_hu CodePen may return 403 to automated probes; independent public evidence still resolves the profile and pens.
- Supabase Dashboard may normalize `https://supabase.com/dashboard` to a route under `/dashboard`.
- Mistral Console may route unauthenticated traffic through Mistral authentication hosts.
- `AGPL-3.0-only` and GitHub's broader `AGPL-3.0` metadata label are treated as equivalent for mismatch triage when the verified project source explicitly states `AGPL-3.0-only`. This does not change the catalog license string.

Expectations must reference existing catalog IDs. Unknown IDs or malformed policy fields fail structural validation.

## Workflow

Workflow: `.github/workflows/resource-health.yml`

Triggers:

- manual `workflow_dispatch`
- weekly on Monday at `03:17 UTC`
- pushes to `main` that change the catalog, health policy, checker, triage layer, or workflow
- pull requests that change those same files

Pull requests run structural validation only so external website availability cannot make a PR flaky.

Scheduled, manual and relevant `main` pushes perform the full network check and reviewed triage.

## Outputs

The full run creates raw evidence:

- `reports/resource-health/resource-health.json`
- `reports/resource-health/resource-health.md`

and reviewed triage:

- `reports/resource-health/resource-health-review.json`
- `reports/resource-health/resource-health-review.md`

All files are uploaded as a GitHub Actions artifact for 30 days. The reviewed Markdown report is appended to the workflow summary, with the raw files retained in the artifact for auditability.

External failures do not automatically fail the workflow. The raw layer preserves what was observed; the triage layer decides whether that observation matches a reviewed expectation or belongs in the review queue.

## Local usage

Validate the catalog only:

```bash
python scripts/resource_health.py --validate-only
```

Validate the reviewed health policy:

```bash
python scripts/resource_health_triage.py --validate-only
```

Run the full raw check and triage:

```bash
python scripts/resource_health.py
python scripts/resource_health_triage.py
```

Use a shorter or longer URL timeout when needed:

```bash
python scripts/resource_health.py --timeout 20
python scripts/resource_health_triage.py
```

When `GITHUB_TOKEN` or `GH_TOKEN` is present, GitHub repository metadata requests use that token. No token is written to the report.

## First-run evidence

Resource Health V0.1 first full run (`33312359208`) observed:

- 39 total resources
- 37 reachable
- 2 restricted / rate-limited
- 2 redirected
- 0 broken 404 / 410
- 0 transient / network / other errors
- 24 GitHub repositories observed
- 1 metadata observation

The initial review queue was Cloudflare Dashboard, xorxor_hu CodePen, Supabase Dashboard, Mistral Studio and World Monitor. V0.2 was introduced specifically to encode the reviewed interpretation of those known conditions without erasing the raw evidence.

## V0.2 limitation

V0.2 still does not create automatic metadata-update PRs. That is deliberate. The next version may generate proposed updates, but verified pricing, licensing, status, canonical URLs and descriptions must continue to require review before promotion into `data/resources.json`.
