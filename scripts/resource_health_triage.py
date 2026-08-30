#!/usr/bin/env python3
"""Apply reviewed expectations to a raw Resource Health report without mutating catalog data."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from urllib import parse

DEFAULT_CATALOG = Path("data/resources.json")
DEFAULT_POLICY = Path("data/resource-health-expectations.json")
DEFAULT_RAW_REPORT = Path("reports/resource-health/resource-health.json")
DEFAULT_OUTPUT_DIR = Path("reports/resource-health")

ALLOWED_POLICY_KEYS = {
    "allowed_url_statuses",
    "allow_redirect",
    "allowed_final_url_prefixes",
    "allowed_final_hosts",
    "ignored_metadata_observations",
    "reason",
}


def load_json(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"{label} not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} JSON is invalid: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"{label} root must be an object")
    return payload


def catalog_ids(catalog: dict[str, Any]) -> set[str]:
    resources = catalog.get("resources")
    if not isinstance(resources, list):
        raise ValueError("catalog.resources must be an array")
    result: set[str] = set()
    for index, resource in enumerate(resources):
        if not isinstance(resource, dict):
            raise ValueError(f"catalog.resources[{index}] must be an object")
        resource_id = resource.get("id")
        if not isinstance(resource_id, str) or not resource_id:
            raise ValueError(f"catalog.resources[{index}].id must be a non-empty string")
        if resource_id in result:
            raise ValueError(f"catalog contains duplicate id: {resource_id}")
        result.add(resource_id)
    return result


def validate_string_list(value: Any, label: str) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
        raise ValueError(f"{label} must be an array of non-empty strings")
    return value


def validate_policy(policy: dict[str, Any], ids: set[str]) -> None:
    if policy.get("schema_version") != "0.1":
        raise ValueError("resource health expectations schema_version must be '0.1'")

    pairs = policy.get("equivalent_license_pairs", [])
    if not isinstance(pairs, list):
        raise ValueError("equivalent_license_pairs must be an array")
    for index, pair in enumerate(pairs):
        if (
            not isinstance(pair, list)
            or len(pair) != 2
            or not all(isinstance(item, str) and item for item in pair)
        ):
            raise ValueError(f"equivalent_license_pairs[{index}] must contain exactly two strings")

    resources = policy.get("resources", {})
    if not isinstance(resources, dict):
        raise ValueError("resource health expectations.resources must be an object")

    unknown_ids = sorted(set(resources) - ids)
    if unknown_ids:
        raise ValueError(f"resource health expectations reference unknown ids: {', '.join(unknown_ids)}")

    for resource_id, rule in resources.items():
        if not isinstance(rule, dict):
            raise ValueError(f"expectations for {resource_id} must be an object")
        unknown_keys = sorted(set(rule) - ALLOWED_POLICY_KEYS)
        if unknown_keys:
            raise ValueError(f"expectations for {resource_id} contain unsupported keys: {', '.join(unknown_keys)}")

        if "allowed_url_statuses" in rule:
            validate_string_list(rule["allowed_url_statuses"], f"{resource_id}.allowed_url_statuses")
        if "allowed_final_url_prefixes" in rule:
            validate_string_list(rule["allowed_final_url_prefixes"], f"{resource_id}.allowed_final_url_prefixes")
        if "allowed_final_hosts" in rule:
            validate_string_list(rule["allowed_final_hosts"], f"{resource_id}.allowed_final_hosts")
        if "ignored_metadata_observations" in rule:
            validate_string_list(
                rule["ignored_metadata_observations"],
                f"{resource_id}.ignored_metadata_observations",
            )
        if "allow_redirect" in rule and not isinstance(rule["allow_redirect"], bool):
            raise ValueError(f"{resource_id}.allow_redirect must be boolean")
        if "reason" in rule and not isinstance(rule["reason"], str):
            raise ValueError(f"{resource_id}.reason must be a string")


def pair_key(a: str | None, b: str | None) -> tuple[str, str] | None:
    if not a or not b:
        return None
    return tuple(sorted((a.strip(), b.strip())))


def equivalent_license_set(policy: dict[str, Any]) -> set[tuple[str, str]]:
    result: set[tuple[str, str]] = set()
    for pair in policy.get("equivalent_license_pairs", []):
        key = pair_key(pair[0], pair[1])
        if key:
            result.add(key)
    return result


def redirect_matches(rule: dict[str, Any], final_url: str | None) -> bool:
    if not rule.get("allow_redirect") or not final_url:
        return False

    prefixes = rule.get("allowed_final_url_prefixes", [])
    hosts = {host.lower() for host in rule.get("allowed_final_hosts", [])}

    if not prefixes and not hosts:
        return True
    if any(final_url.startswith(prefix) for prefix in prefixes):
        return True

    parsed = parse.urlparse(final_url)
    return parsed.hostname is not None and parsed.hostname.lower() in hosts


def is_equivalent_license_observation(
    observation: str,
    item: dict[str, Any],
    equivalents: set[tuple[str, str]],
) -> bool:
    if not observation.startswith("license mismatch:"):
        return False
    catalog_license = (item.get("catalog") or {}).get("license")
    github_license = (item.get("github") or {}).get("license")
    key = pair_key(catalog_license, github_license)
    return bool(key and key in equivalents)


def triage_item(
    item: dict[str, Any],
    rule: dict[str, Any],
    equivalents: set[tuple[str, str]],
) -> dict[str, Any]:
    url_check = item.get("url_check") or {}
    github = item.get("github") or {}
    observations = item.get("metadata_observations") or []

    expected: list[str] = []
    review: list[str] = []
    reason = rule.get("reason")

    status = url_check.get("status")
    error_text = url_check.get("error")
    if status != "reachable":
        allowed_statuses = set(rule.get("allowed_url_statuses", []))
        detail = f"URL status is {status}"
        if error_text:
            detail += f" ({error_text})"
        if status in allowed_statuses:
            expected.append(detail)
        else:
            review.append(detail)

    redirected = bool(url_check.get("redirected"))
    final_url = url_check.get("final_url")
    if redirected:
        detail = f"redirected to {final_url or 'unknown target'}"
        if redirect_matches(rule, final_url):
            expected.append(detail)
            if status == "reachable" and error_text:
                expected.append(f"redirect probe note: {error_text}")
        else:
            review.append(f"unexpected {detail}")
    elif status == "reachable" and error_text:
        review.append(f"reachable response carried probe error: {error_text}")

    if github.get("checked") and github.get("error"):
        review.append(f"GitHub metadata check failed: {github['error']}")

    ignored = set(rule.get("ignored_metadata_observations", []))
    for observation in observations:
        if observation in ignored:
            expected.append(f"metadata observation ignored by reviewed policy: {observation}")
        elif is_equivalent_license_observation(observation, item, equivalents):
            expected.append(f"equivalent SPDX naming: {observation}")
        else:
            review.append(f"metadata observation: {observation}")

    if review:
        review_status = "review-required"
    elif expected:
        review_status = "expected-variance"
    else:
        review_status = "clean"

    return {
        "id": item.get("id"),
        "name": item.get("name"),
        "url": item.get("url"),
        "review_status": review_status,
        "review_reasons": review,
        "expected_variances": expected,
        "expectation_reason": reason,
        "raw": item,
    }


def markdown_cell(value: Any) -> str:
    text = str(value).replace("\n", " ").replace("|", "\\|")
    return text or "—"


def markdown_report(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# Resource Health Review",
        "",
        f"Raw report generated: `{report['raw_generated_at']}`",
        f"Catalog resources: **{summary['total']}**",
        "",
        "## Triage summary",
        "",
        f"- Clean: {summary['clean']}",
        f"- Expected variances: {summary['expected_variances']}",
        f"- Review required: {summary['review_required']}",
        "",
        "> This layer classifies raw observations against reviewed expectations. It still never rewrites `data/resources.json` automatically.",
        "",
        "## Review required",
        "",
        "| Resource | Reasons |",
        "| --- | --- |",
    ]

    review_items = [item for item in report["resources"] if item["review_status"] == "review-required"]
    if review_items:
        for item in review_items:
            reasons = "; ".join(item["review_reasons"])
            lines.append(f"| `{markdown_cell(item['id'])}` | {markdown_cell(reasons)} |")
    else:
        lines.append("| _No review-required items_ | — |")

    lines.extend(
        [
            "",
            "## Expected variances",
            "",
            "| Resource | Observed variance | Reviewed reason |",
            "| --- | --- | --- |",
        ]
    )

    expected_items = [item for item in report["resources"] if item["review_status"] == "expected-variance"]
    if expected_items:
        for item in expected_items:
            observed = "; ".join(item["expected_variances"])
            lines.append(
                f"| `{markdown_cell(item['id'])}` | {markdown_cell(observed)} | "
                f"{markdown_cell(item['expectation_reason'] or 'reviewed global equivalence rule')} |"
            )
    else:
        lines.append("| _No expected variances_ | — | — |")

    lines.extend(
        [
            "",
            "## Raw evidence",
            "",
            "The raw observer report remains available as `resource-health.json` / `resource-health.md`. ",
            "This review file is a policy interpretation layer, not a replacement for raw evidence.",
            "",
        ]
    )
    return "\n".join(lines)


def validate_raw_report(raw: dict[str, Any], ids: set[str]) -> None:
    resources = raw.get("resources")
    if not isinstance(resources, list):
        raise ValueError("raw report.resources must be an array")
    raw_ids: list[str] = []
    for index, item in enumerate(resources):
        if not isinstance(item, dict):
            raise ValueError(f"raw report.resources[{index}] must be an object")
        resource_id = item.get("id")
        if not isinstance(resource_id, str) or not resource_id:
            raise ValueError(f"raw report.resources[{index}].id must be a non-empty string")
        raw_ids.append(resource_id)
    if len(raw_ids) != len(set(raw_ids)):
        raise ValueError("raw report contains duplicate resource ids")
    missing = sorted(ids - set(raw_ids))
    unknown = sorted(set(raw_ids) - ids)
    if missing:
        raise ValueError(f"raw report is missing catalog ids: {', '.join(missing)}")
    if unknown:
        raise ValueError(f"raw report contains unknown ids: {', '.join(unknown)}")


def run(args: argparse.Namespace) -> int:
    try:
        catalog = load_json(args.catalog, "catalog")
        ids = catalog_ids(catalog)
        policy = load_json(args.policy, "resource health expectations")
        validate_policy(policy, ids)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"Resource health expectations validation passed: {len(policy.get('resources', {}))} resource rules")
    if args.validate_only:
        return 0

    try:
        raw = load_json(args.raw_report, "raw resource health report")
        validate_raw_report(raw, ids)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    rules = policy.get("resources", {})
    equivalents = equivalent_license_set(policy)
    triaged = [
        triage_item(item, rules.get(item["id"], {}), equivalents)
        for item in raw["resources"]
    ]

    summary = {
        "total": len(triaged),
        "clean": sum(item["review_status"] == "clean" for item in triaged),
        "expected_variances": sum(item["review_status"] == "expected-variance" for item in triaged),
        "review_required": sum(item["review_status"] == "review-required" for item in triaged),
    }
    report = {
        "schema_version": "0.1",
        "raw_generated_at": raw.get("generated_at"),
        "raw_summary": raw.get("summary"),
        "policy_updated_at": policy.get("updated_at"),
        "summary": summary,
        "resources": triaged,
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "resource-health-review.json"
    md_path = args.output_dir / "resource-health-review.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(markdown_report(report), encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Wrote {json_path} and {md_path}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--raw-report", type=Path, default=DEFAULT_RAW_REPORT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--validate-only", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(run(parse_args()))
