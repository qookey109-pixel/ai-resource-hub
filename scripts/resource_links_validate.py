#!/usr/bin/env python3
"""Validate the supplemental official/secondary resource links registry."""

from __future__ import annotations

import json
from pathlib import Path
from urllib import parse

ROOT = Path(__file__).resolve().parents[1]
RESOURCES_PATH = ROOT / "data" / "resources.json"
LINKS_PATH = ROOT / "data" / "resource-links.json"
ALLOWED_KINDS = {
    "github",
    "website",
    "documentation",
    "demo",
    "gallery",
    "api",
    "download",
    "other",
}
SENSITIVE_QUERY_KEYS = {
    "access_token",
    "api_key",
    "apikey",
    "auth",
    "code",
    "key",
    "secret",
    "sig",
    "signature",
    "token",
}


def load_json(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"missing file: {path.relative_to(ROOT)}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON in {path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"{path.relative_to(ROOT)} root must be an object")
    return payload


def normalize_url(value: str) -> str:
    parsed = parse.urlparse(value)
    path = parsed.path.rstrip("/") or "/"
    return parse.urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), path, "", parsed.query, ""))


def validate() -> list[str]:
    errors: list[str] = []
    resources_doc = load_json(RESOURCES_PATH)
    links_doc = load_json(LINKS_PATH)

    resources = resources_doc.get("resources")
    if not isinstance(resources, list):
        return ["data/resources.json resources must be an array"]

    resource_by_id = {
        resource.get("id"): resource
        for resource in resources
        if isinstance(resource, dict) and isinstance(resource.get("id"), str)
    }

    links = links_doc.get("links")
    if not isinstance(links, dict):
        return ["data/resource-links.json links must be an object"]

    for resource_id, entries in links.items():
        prefix = f"links[{resource_id!r}]"
        resource = resource_by_id.get(resource_id)
        if resource is None:
            errors.append(f"{prefix}: resource id does not exist in data/resources.json")
            continue
        if not isinstance(entries, list) or not entries:
            errors.append(f"{prefix}: must be a non-empty array")
            continue

        canonical = resource.get("url")
        canonical_norm = normalize_url(canonical) if isinstance(canonical, str) else None
        seen: set[str] = set()

        for index, entry in enumerate(entries):
            item = f"{prefix}[{index}]"
            if not isinstance(entry, dict):
                errors.append(f"{item}: must be an object")
                continue

            label = entry.get("label")
            kind = entry.get("kind")
            url = entry.get("url")
            description = entry.get("description")

            if not isinstance(label, str) or not label.strip():
                errors.append(f"{item}.label: must be a non-empty string")
            if kind not in ALLOWED_KINDS:
                errors.append(f"{item}.kind: unsupported value {kind!r}")
            if not isinstance(description, str) or not description.strip():
                errors.append(f"{item}.description: must be a non-empty string")

            if not isinstance(url, str) or not url.strip():
                errors.append(f"{item}.url: must be a non-empty string")
                continue

            parsed = parse.urlparse(url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                errors.append(f"{item}.url: must be an absolute http(s) URL")
                continue

            query_keys = {key.lower() for key, _ in parse.parse_qsl(parsed.query, keep_blank_values=True)}
            risky_keys = sorted(query_keys & SENSITIVE_QUERY_KEYS)
            if risky_keys:
                errors.append(f"{item}.url: contains sensitive-looking query keys: {', '.join(risky_keys)}")

            normalized = normalize_url(url)
            if canonical_norm and normalized == canonical_norm:
                errors.append(f"{item}.url: duplicates canonical resource url")
            if normalized in seen:
                errors.append(f"{item}.url: duplicate secondary link")
            seen.add(normalized)

    return errors


def main() -> int:
    try:
        errors = validate()
    except ValueError as exc:
        print(f"ERROR: {exc}")
        return 1

    if errors:
        print("Resource links validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Resource links validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
