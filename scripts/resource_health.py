#!/usr/bin/env python3
"""Validate the resource catalog and produce non-destructive URL/GitHub health reports."""

from __future__ import annotations

import argparse
import json
import os
import re
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

RESOURCE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ALLOWED_TYPES = {"website", "github", "documentation", "service", "library", "model", "dataset", "platform", "other"}
ALLOWED_PRICING = {"free", "freemium", "paid", "open-source", "unknown"}
ALLOWED_DIFFICULTY = {"beginner", "intermediate", "advanced", "unknown"}
ALLOWED_STATUS = {"active", "inactive", "deprecated", "archived", "unknown"}
HUB_ICON_HOST = "qookey109-pixel.github.io"
HUB_ICON_PATH_PREFIX = "/ai-resource-hub/"


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


def load_json_object(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"{label} not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} JSON is invalid: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"{label} root must be an object")
    return payload


def validate_local_icon_assets(
    icons_payload: dict[str, Any],
    repo_root: Path,
) -> list[str]:
    errors: list[str] = []
    icons = icons_payload.get("icons")
    if not isinstance(icons, dict):
        return errors

    for icon_id, icon in icons.items():
        if not isinstance(icon, dict):
            continue
        icon_url = icon.get("url")
        if not isinstance(icon_url, str) or not icon_url.strip():
            continue

        parsed = parse.urlparse(icon_url)
        if parsed.hostname != HUB_ICON_HOST or not parsed.path.startswith(HUB_ICON_PATH_PREFIX):
            continue

        relative_path = parsed.path.removeprefix(HUB_ICON_PATH_PREFIX)
        local_path = Path(relative_path)
        if not relative_path or local_path.is_absolute() or ".." in local_path.parts:
            errors.append(f"icons.{icon_id}.url: invalid local published asset path")
            continue

        asset_path = repo_root / local_path
        if not asset_path.is_file():
            errors.append(
                f"icons.{icon_id}.url: local published asset is missing: {local_path.as_posix()}"
            )

    return errors


def validate_catalog(
    payload: dict[str, Any],
    categories_payload: dict[str, Any],
    icons_payload: dict[str, Any],
) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    seen_urls: dict[str, str] = {}

    category_items = categories_payload.get("categories")
    allowed_categories: set[str] = set()
    seen_category_ids: set[str] = set()
    if not isinstance(category_items, list):
        errors.append("categories.categories: must be an array")
    else:
        for index, category in enumerate(category_items):
            prefix = f"categories[{index}]"
            if not isinstance(category, dict):
                errors.append(f"{prefix}: must be an object")
                continue
            category_id = category.get("id")
            name = category.get("name")
            if not isinstance(category_id, str) or not category_id.strip():
                errors.append(f"{prefix}.id: must be a non-empty string")
            elif category_id in seen_category_ids:
                errors.append(f"{prefix}.id: duplicate category id {category_id!r}")
            else:
                seen_category_ids.add(category_id)
            if not isinstance(name, str) or not name.strip():
                errors.append(f"{prefix}.name: must be a non-empty string")
            elif name in allowed_categories:
                errors.append(f"{prefix}.name: duplicate category name {name!r}")
            else:
                allowed_categories.add(name)
            for field in ("display_name", "icon"):
                if not isinstance(category.get(field), str) or not category.get(field, "").strip():
                    errors.append(f"{prefix}.{field}: must be a non-empty string")

    if icons_payload.get("schema_version") != "0.2":
        errors.append("icons.schema_version: must be '0.2'")

    icon_updated_at = icons_payload.get("updated_at")
    if not isinstance(icon_updated_at, str):
        errors.append("icons.updated_at: must be YYYY-MM-DD")
    else:
        try:
            datetime.strptime(icon_updated_at, "%Y-%m-%d")
        except ValueError:
            errors.append("icons.updated_at: must be YYYY-MM-DD")

    icons = icons_payload.get("icons")
    if not isinstance(icons, dict):
        errors.append("icons.icons: must be an object")
        icons = {}
    else:
        for icon_id, icon in icons.items():
            prefix = f"icons.{icon_id}"
            if not isinstance(icon_id, str) or not RESOURCE_ID_PATTERN.fullmatch(icon_id):
                errors.append(f"{prefix}: icon id must be lower-case kebab-case")
                continue
            if not isinstance(icon, dict):
                errors.append(f"{prefix}: must be an object")
                continue

            icon_url = icon.get("url")
            if not isinstance(icon_url, str) or not icon_url.strip():
                errors.append(f"{prefix}.url: must be a non-empty string")
            else:
                parsed_icon_url = parse.urlparse(icon_url)
                if parsed_icon_url.scheme not in {"http", "https"} or not parsed_icon_url.netloc:
                    errors.append(f"{prefix}.url: must be an absolute http(s) URL")

            icon_source = icon.get("source")
            if (
                not isinstance(icon_source, str)
                or not RESOURCE_ID_PATTERN.fullmatch(icon_source)
            ):
                errors.append(f"{prefix}.source: must be lower-case kebab-case")

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
        elif not RESOURCE_ID_PATTERN.fullmatch(resource_id):
            errors.append(f"{prefix}.id: must be lower-case kebab-case")
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
            else:
                normalized = normalize_url(url)
                previous_id = seen_urls.get(normalized)
                if previous_id:
                    errors.append(f"{prefix}.url: duplicate canonical URL also used by {previous_id!r}")
                elif isinstance(resource_id, str):
                    seen_urls[normalized] = resource_id

        name = resource.get("name")
        summary = resource.get("summary")
        notes = resource.get("notes")
        if not isinstance(name, str) or not name.strip():
            errors.append(f"{prefix}.name: must be a non-empty string")
        if not isinstance(summary, str) or not summary.strip():
            errors.append(f"{prefix}.summary: must be a non-empty string")
        if not isinstance(notes, str):
            errors.append(f"{prefix}.notes: must be a string")

        categories = resource.get("categories")
        if not isinstance(categories, list) or not categories:
            errors.append(f"{prefix}.categories: must be a non-empty array")
        else:
            string_categories = [category for category in categories if isinstance(category, str)]
            if len(string_categories) != len(categories) or any(not category.strip() for category in string_categories):
                errors.append(f"{prefix}.categories: values must be non-empty strings")
            if len(string_categories) != len(set(string_categories)):
                errors.append(f"{prefix}.categories: duplicate values are not allowed")
            for category in string_categories:
                if category and category not in allowed_categories:
                    errors.append(f"{prefix}.categories: unknown category {category!r}")

        tags = resource.get("tags")
        if not isinstance(tags, list) or not tags:
            errors.append(f"{prefix}.tags: must be a non-empty array")
        else:
            string_tags = [tag for tag in tags if isinstance(tag, str)]
            if len(string_tags) != len(tags) or any(not tag.strip() for tag in string_tags):
                errors.append(f"{prefix}.tags: values must be non-empty strings")
            if any(tag != tag.lower() for tag in string_tags):
                errors.append(f"{prefix}.tags: values must be lower-case")
            if len(string_tags) != len(set(string_tags)):
                errors.append(f"{prefix}.tags: duplicate values are not allowed")

        use_cases = resource.get("use_cases")
        if not isinstance(use_cases, list) or not use_cases:
            errors.append(f"{prefix}.use_cases: must be a non-empty array")
        elif any(not isinstance(item, str) or not item.strip() for item in use_cases):
            errors.append(f"{prefix}.use_cases: values must be non-empty strings")

        enum_fields = {
            "type": ALLOWED_TYPES,
            "pricing": ALLOWED_PRICING,
            "difficulty": ALLOWED_DIFFICULTY,
            "status": ALLOWED_STATUS,
        }
        for field, allowed in enum_fields.items():
            if resource.get(field) not in allowed:
                errors.append(f"{prefix}.{field}: unsupported value {resource.get(field)!r}")

        open_source = resource.get("open_source")
        if open_source is not None and not isinstance(open_source, bool):
            errors.append(f"{prefix}.open_source: must be true, false, or null")

        license_value = resource.get("license")
        if license_value is not None and not isinstance(license_value, str):
            errors.append(f"{prefix}.license: must be a string or null")

        rating = resource.get("rating")
        if rating is not None and (
            not isinstance(rating, int)
            or isinstance(rating, bool)
            or not 1 <= rating <= 5
        ):
            errors.append(f"{prefix}.rating: must be an integer from 1 to 5 or null")

        for field in ("added_at", "last_checked"):
            value = resource.get(field)
            if not isinstance(value, str):
                errors.append(f"{prefix}.{field}: must be YYYY-MM-DD")
                continue
            try:
                datetime.strptime(value, "%Y-%m-%d")
            except ValueError:
                errors.append(f"{prefix}.{field}: must be YYYY-MM-DD")

    missing_icons = sorted(seen_ids - set(icons))
    orphan_icons = sorted(set(icons) - seen_ids)
    if missing_icons:
        errors.append("icons: missing resource ids: " + ", ".join(missing_icons))
    if orphan_icons:
        errors.append("icons: orphan resource ids: " + ", ".join(orphan_icons))

    for resource_id, icon in icons.items():
        prefix = f"icons[{resource_id!r}]"
        if not isinstance(icon, dict):
            errors.append(f"{prefix}: must be an object")
            continue
        icon_url = icon.get("url")
        source = icon.get("source")
        if not isinstance(icon_url, str) or not icon_url.strip():
            errors.append(f"{prefix}.url: must be a non-empty string")
        else:
            parsed = parse.urlparse(icon_url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                errors.append(f"{prefix}.url: must be an absolute http(s) URL")
        if not isinstance(source, str) or not source.strip():
            errors.append(f"{prefix}.source: must be a non-empty string")

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


def freshness_age_days(last_checked: str, as_of: datetime) -> int:
    checked_date = datetime.strptime(last_checked, "%Y-%m-%d").date()
    return (as_of.date() - checked_date).days


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
        f"- Metadata checked within 14 days: {summary['metadata_checked_within_14d']}",
        f"- Metadata older than 14 days: {summary['metadata_older_than_14d']}",
        f"- Metadata older than 30 days: {summary['metadata_older_than_30d']}",
        f"- Oldest metadata check age: {summary['oldest_metadata_check_age_days']} days",
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
        categories = load_json_object(args.categories, "categories registry")
        icons = load_json_object(args.icons, "icon registry")
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    validation_errors = validate_catalog(catalog, categories, icons)
    repo_root = args.icons.parent.parent
    validation_errors.extend(validate_local_icon_assets(icons, repo_root))
    if validation_errors:
        print("Catalog validation failed:", file=sys.stderr)
        for item in validation_errors:
            print(f"- {item}", file=sys.stderr)
        return 1

    print(f"Catalog validation passed: {len(catalog['resources'])} resources")

    icon_registry = icons.get("icons") if isinstance(icons.get("icons"), dict) else {}
    icon_sources = {
        resource_id: icon.get("source", "")
        for resource_id, icon in icon_registry.items()
        if isinstance(icon, dict)
    }
    official_icon_ids = sorted(
        resource_id
        for resource_id, source in icon_sources.items()
        if source.startswith("official-")
    )
    fallback_icon_ids = sorted(
        resource_id
        for resource_id, source in icon_sources.items()
        if "fallback" in source
    )
    github_avatar_ids = sorted(
        resource_id
        for resource_id, source in icon_sources.items()
        if (
            source.startswith("github-owner-avatar")
            or source.startswith("github-organization-avatar")
        )
        and "fallback" not in source
    )
    domain_favicon_ids = sorted(
        resource_id
        for resource_id, source in icon_sources.items()
        if source.startswith("domain-favicon")
    )
    print(
        "Icon registry sources (mutually exclusive): "
        f"official-labelled={len(official_icon_ids)}/{len(icon_sources)}, "
        f"github-avatar={len(github_avatar_ids)}, "
        f"fallback-labelled={len(fallback_icon_ids)}, "
        f"domain-favicon={len(domain_favicon_ids)}"
    )
    if fallback_icon_ids:
        print("Fallback-labelled icons: " + ", ".join(fallback_icon_ids))

    if args.validate_only:
        return 0

    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    generated_at = datetime.now(timezone.utc)
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
                "freshness_age_days": freshness_age_days(resource["last_checked"], generated_at),
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
        "metadata_checked_within_14d": sum(item["freshness_age_days"] <= 14 for item in results),
        "metadata_older_than_14d": sum(item["freshness_age_days"] > 14 for item in results),
        "metadata_older_than_30d": sum(item["freshness_age_days"] > 30 for item in results),
        "oldest_metadata_check_age_days": max((item["freshness_age_days"] for item in results), default=0),
    }
    report = {
        "schema_version": "0.1",
        "generated_at": generated_at.isoformat(),
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
    parser.add_argument("--categories", type=Path, default=Path("data/categories.json"))
    parser.add_argument("--icons", type=Path, default=Path("data/resource-icons.json"))
    parser.add_argument("--output-dir", type=Path, default=Path("reports/resource-health"))
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument("--validate-only", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(run(parse_args()))
