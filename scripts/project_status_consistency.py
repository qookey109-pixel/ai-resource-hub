#!/usr/bin/env python3
"""Validate that PROJECT_STATUS.md stays aligned with canonical project data."""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS_PATH = ROOT / "PROJECT_STATUS.md"
CANONICAL_DATA_PATHS = [
    ROOT / "data/resources.json",
    ROOT / "data/categories.json",
    ROOT / "data/resource-icons.json",
    ROOT / "data/resource-links.json",
    ROOT / "data/resource-health-expectations.json",
    ROOT / "data/ai-config.json",
    ROOT / "data/click-config.json",
]

STATUS_DATE_RE = re.compile(
    r"^Status date:\s*`?(\d{4}-\d{2}-\d{2})`?(?:\s*\(Asia/Taipei\))?\s*$",
    re.MULTILINE,
)
CATALOG_SIZE_RE = re.compile(
    r"^- Current canonical catalog size:\s*\*\*(\d+) resources\*\*\s*$",
    re.MULTILINE,
)
SUPPLEMENTAL_LINKS_RE = re.compile(
    r"^- supplemental official links:\s*\*\*(\d+)\s*/\s*(\d+) resources \(([\d.]+)%\)\*\*\s*$",
    re.MULTILINE,
)
ICON_COVERAGE_RE = re.compile(
    r"^- icon registry coverage:\s*\*\*(\d+)\s*/\s*(\d+) resources\*\*\s*$",
    re.MULTILINE,
)
ICON_SOURCES_RE = re.compile(
    r"^- icon sources \(mutually exclusive\):\s*\*\*(\d+) official-labelled\*\*,\s*\*\*(\d+) GitHub-avatar\*\*,\s*\*\*(\d+) fallback-labelled\*\*,\s*\*\*(\d+) domain-favicon\*\*\s*$",
    re.MULTILINE,
)


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"missing canonical file: {path.relative_to(ROOT)}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON in {path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object in {path.relative_to(ROOT)}")
    return value


def parse_iso_date(value: object, label: str) -> date:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label} is missing a YYYY-MM-DD date")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{label} is not a valid YYYY-MM-DD date: {value!r}") from exc


def main() -> int:
    errors: list[str] = []

    try:
        status_text = STATUS_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        print("ERROR: PROJECT_STATUS.md is missing", file=sys.stderr)
        return 1

    status_dates = STATUS_DATE_RE.findall(status_text)
    if len(status_dates) != 1:
        errors.append(f"expected exactly one Status date marker, found {len(status_dates)}")
        status_date = None
    else:
        try:
            status_date = parse_iso_date(status_dates[0], "PROJECT_STATUS Status date")
        except ValueError as exc:
            errors.append(str(exc))
            status_date = None

    try:
        resources_doc = load_json(ROOT / "data/resources.json")
    except ValueError as exc:
        errors.append(str(exc))
        resources_doc = {}

    resources = resources_doc.get("resources")
    if not isinstance(resources, list):
        errors.append("data/resources.json must contain a resources array")
        resource_count = None
    else:
        resource_count = len(resources)

    size_markers = CATALOG_SIZE_RE.findall(status_text)
    if len(size_markers) != 1:
        errors.append(
            f"expected exactly one Current canonical catalog size marker, found {len(size_markers)}"
        )
    elif resource_count is not None and int(size_markers[0]) != resource_count:
        errors.append(
            "catalog size drift: PROJECT_STATUS.md says "
            f"{size_markers[0]} but data/resources.json contains {resource_count}"
        )

    try:
        links_doc = load_json(ROOT / "data/resource-links.json")
        icons_doc = load_json(ROOT / "data/resource-icons.json")
    except ValueError as exc:
        errors.append(str(exc))
        links_doc = {}
        icons_doc = {}

    if resource_count is not None and isinstance(resources, list):
        resource_ids = {
            resource.get("id")
            for resource in resources
            if isinstance(resource, dict) and isinstance(resource.get("id"), str)
        }

        link_registry = links_doc.get("links")
        if isinstance(link_registry, dict):
            linked_count = sum(
                resource_id in link_registry
                and isinstance(link_registry.get(resource_id), list)
                and len(link_registry.get(resource_id)) > 0
                for resource_id in resource_ids
            )
            link_markers = SUPPLEMENTAL_LINKS_RE.findall(status_text)
            if len(link_markers) != 1:
                errors.append(
                    "expected exactly one supplemental official links marker, "
                    f"found {len(link_markers)}"
                )
            else:
                status_linked, status_total, status_percent = link_markers[0]
                expected_percent = round((linked_count / resource_count) * 100, 1) if resource_count else 0.0
                if int(status_linked) != linked_count or int(status_total) != resource_count:
                    errors.append(
                        "supplemental-link coverage drift: PROJECT_STATUS.md says "
                        f"{status_linked}/{status_total} but registry coverage is "
                        f"{linked_count}/{resource_count}"
                    )
                if float(status_percent) != expected_percent:
                    errors.append(
                        "supplemental-link percentage drift: PROJECT_STATUS.md says "
                        f"{status_percent}% but registry coverage is {expected_percent:.1f}%"
                    )

        icon_registry = icons_doc.get("icons")
        if isinstance(icon_registry, dict):
            icon_count = sum(resource_id in icon_registry for resource_id in resource_ids)
            coverage_markers = ICON_COVERAGE_RE.findall(status_text)
            if len(coverage_markers) != 1:
                errors.append(
                    f"expected exactly one icon registry coverage marker, found {len(coverage_markers)}"
                )
            else:
                status_icons, status_total = coverage_markers[0]
                if int(status_icons) != icon_count or int(status_total) != resource_count:
                    errors.append(
                        "icon coverage drift: PROJECT_STATUS.md says "
                        f"{status_icons}/{status_total} but registry coverage is "
                        f"{icon_count}/{resource_count}"
                    )

            sources = [
                icon.get("source", "")
                for resource_id, icon in icon_registry.items()
                if resource_id in resource_ids and isinstance(icon, dict)
            ]
            official_count = sum(source.startswith("official-") for source in sources)
            fallback_count = sum("fallback" in source for source in sources)
            avatar_count = sum(
                (
                    source.startswith("github-owner-avatar")
                    or source.startswith("github-organization-avatar")
                )
                and "fallback" not in source
                for source in sources
            )
            domain_favicon_count = sum(source.startswith("domain-favicon") for source in sources)
            classified_count = (
                official_count
                + avatar_count
                + fallback_count
                + domain_favicon_count
            )
            if classified_count != icon_count:
                errors.append(
                    "icon source classification drift: "
                    f"classified={classified_count} but registry coverage is {icon_count}"
                )

            source_markers = ICON_SOURCES_RE.findall(status_text)
            if len(source_markers) != 1:
                errors.append(
                    f"expected exactly one icon sources marker, found {len(source_markers)}"
                )
            else:
                status_official, status_avatar, status_fallback, status_domain = map(
                    int, source_markers[0]
                )
                if (
                    status_official,
                    status_avatar,
                    status_fallback,
                    status_domain,
                ) != (
                    official_count,
                    avatar_count,
                    fallback_count,
                    domain_favicon_count,
                ):
                    errors.append(
                        "icon source count drift: PROJECT_STATUS.md says "
                        f"{status_official}/{status_avatar}/{status_fallback}/{status_domain} "
                        "but registry is "
                        f"{official_count}/{avatar_count}/{fallback_count}/{domain_favicon_count}"
                    )

    latest_data_date: date | None = None
    latest_data_sources: list[str] = []
    for path in CANONICAL_DATA_PATHS:
        try:
            doc = load_json(path)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        updated_at = doc.get("updated_at")
        if updated_at is None:
            continue
        try:
            parsed = parse_iso_date(updated_at, f"{path.relative_to(ROOT)} updated_at")
        except ValueError as exc:
            errors.append(str(exc))
            continue
        if latest_data_date is None or parsed > latest_data_date:
            latest_data_date = parsed
            latest_data_sources = [str(path.relative_to(ROOT))]
        elif parsed == latest_data_date:
            latest_data_sources.append(str(path.relative_to(ROOT)))

    if status_date is not None and latest_data_date is not None and status_date < latest_data_date:
        errors.append(
            "status date drift: PROJECT_STATUS.md is dated "
            f"{status_date.isoformat()} but canonical data is updated through "
            f"{latest_data_date.isoformat()} ({', '.join(latest_data_sources)})"
        )

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(
        "Project status consistency PASS: "
        f"catalog_resources={resource_count}, "
        f"status_date={status_date.isoformat() if status_date else 'unknown'}, "
        f"latest_data_date={latest_data_date.isoformat() if latest_data_date else 'unknown'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
