#!/usr/bin/env python3
"""Validate the resource catalog and produce non-destructive URL/GitHub health reports."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error, parse, request

DEFAULT_TIMEOUT = 12
USER_AGENT = "QookeyAIResourceHubHealth/0.1 (+https://github.com/qookey109-pixel/ai-resource-hub)"
REQUIRED_FIELDS = {
    "id",
    "name",
    "type",
    "url",
    "categories",
    "tags",
    "summary",
    "use_cases",
    "pricing",
    "open_source",
    "license",
    "difficulty",
    "status",
    "rating",
    "added_at",
    "last_checked",
    "notes",
}


@dataclass
class UrlResult:
    status: str
    http_status: int | None
    final_url: str | None
    redirected: bool
    error: str | None
    elapsed_ms: int | None


@dataclass
class GithubResult:
    checked: bool
    repository: str | None
    api_status: int | None
    archived: bool | None
    disabled: bool | None
    pushed_at: str | None
    updated_at: str | None
    stars: int | None
    forks: int | None
    license: str | None
    error: str | None


def load_catalog(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"catalog not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"catalog JSON is invalid: {exc}") from exc

    if not isinstance(payload, dict):
        raise ValueError("catalog root must be an object")
    resources = payload.get("resources")
    if not isinstance(resources, list):
        raise ValueError("catalog.resources must be an array")
    return payload


def validate_catalog(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()

    for index, resource in enumerate(payload["resources"]):
        prefix = f"resources[{index}]"
        if not isinstance(resource, dict):
            errors.append(f"{prefix}: must be an object")
            continue

        missing = sorted(REQUIRED_FIELDS - set(resource))
        if missing:
            errors.append(f"{prefix}: missing fields: {', '.join(missing)}")

        resource_id = resource.get("id")
        if not isinstance(resource_id, str) or not resource_id.strip():
            errors.append(f"{prefix}.id: must be a non-empty string")
        elif resource_id in seen_ids:
            errors.append(f"{prefix}.id: duplicate id {resource_id!r}")
        else:
            seen_ids.add(resource_id)

        url = resource.get("url")
        if not isinstance(url, str) or not url.strip():
            errors.append(f"{prefix}.url: must be a non-empty string")
        else:
            parsed = parse.urlparse(url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                errors.append(f"{prefix}.url: must be an absolute http(s) URL")

        for field in ("categories", "tags", "use_cases"):
            value = resource.get(field)
            if not isinstance(value, list) or not value:
                errors.append(f"{prefix}.{field}: must be a non-empty array")

    return errors


def build_request(url: str, method: str, token: str | None = None) -> request.Request:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    return request.Request(url, method=method, headers=headers)


def classify_http(status: int) -> str:
    if 200 <= status < 400:
        return "reachable"
    if status in {401, 403, 429}:
        return "restricted"
    if status in {404, 410}:
        return "broken"
    if 500 <= status < 600:
        return "transient_error"
    return "http_error"


def normalize_url(url: str) -> str:
    parsed = parse.urlparse(url)
    path = parsed.path.rstrip("/") or "/"
    return parse.urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), path, "", parsed.query, ""))


def check_url(url: str, timeout: int) -> UrlResult:
    start = time.monotonic()
    last_error: str | None = None

    for method in ("HEAD", "GET"):
        try:
            with request.urlopen(build_request(url, method), timeout=timeout) as response:
                status = int(response.status)
                final_url = response.geturl()
                elapsed_ms = round((time.monotonic() - start) * 1000)
                return UrlResult(
                    status=classify_http(status),
                    http_status=status,
                    final_url=final_url,
                    redirected=normalize_url(final_url) != normalize_url(url),
                    error=None,
                    elapsed_ms=elapsed_ms,
                )
        except error.HTTPError as exc:
            status = int(exc.code)
            if method == "HEAD" and status in {400, 405, 501}:
                last_error = f"HEAD HTTP {status}; retried with GET"
                continue
            elapsed_ms = round((time.monotonic() - start) * 1000)
            final_url = exc.geturl() if hasattr(exc, "geturl") else url
            return UrlResult(
                status=classify_http(status),
                http_status=status,
                final_url=final_url,
                redirected=normalize_url(final_url) != normalize_url(url),
                error=str(exc.reason) if exc.reason else last_error,
                elapsed_ms=elapsed_ms,
            )
        except (error.URLError, TimeoutError, OSError) as exc:
            if method == "HEAD":
                last_error = str(getattr(exc, "reason", exc))
                continue
            elapsed_ms = round((time.monotonic() - start) * 1000)
            return UrlResult(
                status="network_error",
                http_status=None,
                final_url=None,
                redirected=False,
                error=str(getattr(exc, "reason", exc)),
                elapsed_ms=elapsed_ms,
            )

    elapsed_ms = round((time.monotonic() - start) * 1000)
    return UrlResult(
        status="network_error",
        http_status=None,
        final_url=None,
        redirected=False,
        error=last_error or "unknown network error",
        elapsed_ms=elapsed_ms,
    )


def github_repository_from_url(url: str) -> str | None:
    parsed = parse.urlparse(url)
    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        return None
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2:
        return None
    owner, repo = parts[0], parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]
    if not owner or not repo:
        return None
    return f"{owner}/{repo}"


def check_github(repository: str | None, timeout: int, token: str | None) -> GithubResult:
    if not repository:
        return GithubResult(False, None, None, None, None, None, None, None, None, None, None)

    api_url = f"https://api.github.com/repos/{repository}"
    try:
        with request.urlopen(build_request(api_url, "GET", token), timeout=timeout) as response:
            status = int(response.status)
            payload = json.load(response)
            license_info = payload.get("license") or {}
            return GithubResult(
                checked=True,
                repository=repository,
                api_status=status,
                archived=payload.get("archived"),
                disabled=payload.get("disabled"),
                pushed_at=payload.get("pushed_at"),
                updated_at=payload.get("updated_at"),
                stars=payload.get("stargazers_count"),
                forks=payload.get("forks_count"),
                license=license_info.get("spdx_id"),
                error=None,
            )
    except error.HTTPError as exc:
        return GithubResult(True, repository, int(exc.code), None, None, None, None, None, None, None, str(exc.reason))
    except (error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        return GithubResult(True, repository, None, None, None, None, None, None, None, None, str(getattr(exc, "reason", exc)))


def github_observations(resource: dict[str, Any], github: GithubResult) -> list[str]:
    notes: list[str] = []
    if not github.checked or github.error:
        return notes
    if github.archived is True and resource.get("status") == "active":
        notes.append("repository is archived but catalog status is active")
    if github.disabled is True:
        notes.append("repository is disabled")

    recorded_license = resource.get("license")
    if github.license and github.license != "NOASSERTION":
        if recorded_license in {None, "unknown"}:
            notes.append(f"GitHub now reports license {github.license}; catalog license is unset")
        elif recorded_license != github.license:
            notes.append(f"license mismatch: catalog={recorded_license}, GitHub={github.license}")
    return notes


def markdown_cell(value: Any) -> str:
    text = str(value).replace("\n", " ").replace("|", "\\|")
    return text or "—"


def markdown_report(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# Resource Health Report",
        "",
        f"Generated: `{report['generated_at']}`",
        f"Catalog resources: **{summary['total']}**",
        "",
        "## Summary",
        "",
        f"- Reachable: {summary['reachable']}",
        f"- Restricted / rate-limited: {summary['restricted']}",
        f"- Redirected: {summary['redirected']}",
        f"- Broken (404/410): {summary['broken']}",
        f"- Transient/network/other errors: {summary['errors']}",
        f"- GitHub repositories observed: {summary['github_checked']}",
        f"- Metadata observations requiring review: {summary['metadata_observations']}",
        "",
        "> This report is observational. It never rewrites `data/resources.json` automatically.",
        "",
        "## Review queue",
        "",
        "| Resource | URL status | HTTP | Redirect | GitHub | Notes |",
        "| --- | --- | ---: | --- | --- | --- |",
    ]

    review_items = []
    for item in report["resources"]:
        url = item["url_check"]
        observations = item["metadata_observations"]
        needs_review = (
            url["status"] not in {"reachable"}
            or url["redirected"]
            or observations
            or (item["github"]["checked"] and item["github"]["error"])
        )
        if needs_review:
            review_items.append(item)

    if not review_items:
        lines.append("| _No review items_ | — | — | — | — | — |")
    else:
        for item in review_items:
            url = item["url_check"]
            gh = item["github"]
            notes = list(item["metadata_observations"])
            if url.get("error"):
                notes.append(f"URL: {url['error']}")
            if gh.get("error"):
                notes.append(f"GitHub: {gh['error']}")
            note_text = "; ".join(notes) if notes else "—"
            lines.append(
                f"| `{markdown_cell(item['id'])}` | {markdown_cell(url['status'])} | "
                f"{url['http_status'] or '—'} | {'yes' if url['redirected'] else 'no'} | "
                f"{markdown_cell(gh['repository'] or '—')} | {markdown_cell(note_text)} |"
            )

    lines.extend(["", "## Machine-readable output", "", "See the accompanying `resource-health.json` artifact.", ""])
    return "\n".join(lines)


def run(args: argparse.Namespace) -> int:
    try:
        catalog = load_catalog(args.catalog)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    validation_errors = validate_catalog(catalog)
    if validation_errors:
        print("Catalog validation failed:", file=sys.stderr)
        for item in validation_errors:
            print(f"- {item}", file=sys.stderr)
        return 1

    print(f"Catalog validation passed: {len(catalog['resources'])} resources")
    if args.validate_only:
        return 0

    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    results: list[dict[str, Any]] = []

    for index, resource in enumerate(catalog["resources"], start=1):
        url = resource["url"]
        print(f"[{index}/{len(catalog['resources'])}] {resource['id']}: {url}", flush=True)
        url_result = check_url(url, args.timeout)
        repository = github_repository_from_url(url)
        github_result = check_github(repository, args.timeout, token)
        observations = github_observations(resource, github_result)
        results.append(
            {
                "id": resource["id"],
                "name": resource["name"],
                "url": url,
                "catalog": {
                    "type": resource.get("type"),
                    "status": resource.get("status"),
                    "license": resource.get("license"),
                    "last_checked": resource.get("last_checked"),
                },
                "url_check": asdict(url_result),
                "github": asdict(github_result),
                "metadata_observations": observations,
            }
        )

    summary = {
        "total": len(results),
        "reachable": sum(item["url_check"]["status"] == "reachable" for item in results),
        "restricted": sum(item["url_check"]["status"] == "restricted" for item in results),
        "redirected": sum(bool(item["url_check"]["redirected"]) for item in results),
        "broken": sum(item["url_check"]["status"] == "broken" for item in results),
        "errors": sum(
            item["url_check"]["status"] in {"transient_error", "network_error", "http_error"}
            for item in results
        ),
        "github_checked": sum(bool(item["github"]["checked"]) for item in results),
        "metadata_observations": sum(len(item["metadata_observations"]) for item in results),
    }
    report = {
        "schema_version": "0.1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "catalog_path": str(args.catalog),
        "summary": summary,
        "resources": results,
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "resource-health.json"
    md_path = args.output_dir / "resource-health.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(markdown_report(report), encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Wrote {json_path} and {md_path}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=Path("data/resources.json"))
    parser.add_argument("--output-dir", type=Path, default=Path("reports/resource-health"))
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument("--validate-only", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(run(parse_args()))
