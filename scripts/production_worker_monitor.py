#!/usr/bin/env python3
"""Read-only production checks for the AI recommender and shared click worker."""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlunparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports/production-workers"
SITE_ORIGIN = "https://qookey109-pixel.github.io"
USER_AGENT = "Qookey-AI-Resource-Hub-Production-Monitor/0.1"
SEMANTIC_QUERY = (
    "我要用 Codex 製作原生可編輯的 PowerPoint／PPTX 簡報，"
    "需要簡報規劃與輸出 Skill，請推薦最適合的資源。"
)


class MonitorError(RuntimeError):
    pass


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise MonitorError(f"missing file: {path.relative_to(ROOT)}") from exc
    except json.JSONDecodeError as exc:
        raise MonitorError(f"invalid JSON in {path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(value, dict):
        raise MonitorError(f"expected JSON object in {path.relative_to(ROOT)}")
    return value


def validate_endpoint(endpoint: object, expected_path: str, label: str) -> str:
    if not isinstance(endpoint, str) or not endpoint.strip():
        raise MonitorError(f"{label} endpoint is missing")
    endpoint = endpoint.strip()
    parsed = urlparse(endpoint)
    if parsed.scheme != "https" or not parsed.netloc:
        raise MonitorError(f"{label} endpoint must be an absolute HTTPS URL: {endpoint}")
    if parsed.path.rstrip("/") != expected_path.rstrip("/"):
        raise MonitorError(
            f"{label} endpoint path must be {expected_path}, got {parsed.path or '/'}"
        )
    if parsed.query or parsed.fragment:
        raise MonitorError(f"{label} endpoint must not contain query/fragment data")
    return endpoint


def health_url(endpoint: str) -> str:
    parsed = urlparse(endpoint)
    return urlunparse((parsed.scheme, parsed.netloc, "/health", "", "", ""))


def presentation_candidate(resource: dict[str, Any]) -> bool:
    categories = resource.get("categories") or []
    if "Agent Skills" not in categories:
        return False
    parts = [
        resource.get("name", ""),
        resource.get("summary", ""),
        resource.get("notes", ""),
        *(resource.get("tags") or []),
        *(resource.get("use_cases") or []),
    ]
    text = " ".join(str(part) for part in parts).lower()
    return any(term in text for term in ("pptx", "powerpoint", "presentation", "簡報"))


def validate_local_configuration() -> dict[str, Any]:
    ai_config = load_json(ROOT / "data/ai-config.json")
    click_config = load_json(ROOT / "data/click-config.json")
    catalog = load_json(ROOT / "data/resources.json")

    if ai_config.get("enabled") is not True:
        raise MonitorError("AI recommender is not enabled in data/ai-config.json")
    if click_config.get("enabled") is not True:
        raise MonitorError("click worker is not enabled in data/click-config.json")

    ai_endpoint = validate_endpoint(ai_config.get("endpoint"), "/api/recommend", "AI")
    click_endpoint = validate_endpoint(
        click_config.get("endpoint"), "/api/resource-clicks", "click"
    )

    resources = catalog.get("resources")
    if not isinstance(resources, list) or not resources:
        raise MonitorError("data/resources.json must contain a non-empty resources array")

    resource_by_id: dict[str, dict[str, Any]] = {}
    for resource in resources:
        if not isinstance(resource, dict):
            raise MonitorError("catalog resources must be JSON objects")
        resource_id = resource.get("id")
        if not isinstance(resource_id, str) or not resource_id:
            raise MonitorError("every catalog resource must have a non-empty id")
        if resource_id in resource_by_id:
            raise MonitorError(f"duplicate catalog resource id: {resource_id}")
        resource_by_id[resource_id] = resource

    presentation_ids = {
        resource_id
        for resource_id, resource in resource_by_id.items()
        if presentation_candidate(resource)
    }
    if not presentation_ids:
        raise MonitorError(
            "semantic regression fixture is stale: no presentation/PPTX Agent Skill exists"
        )

    return {
        "ai_endpoint": ai_endpoint,
        "click_endpoint": click_endpoint,
        "resource_by_id": resource_by_id,
        "presentation_ids": presentation_ids,
    }


def request_json(
    url: str,
    *,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    timeout: float,
) -> tuple[int, dict[str, Any], int]:
    encoded = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "Origin": SITE_ORIGIN,
        "User-Agent": USER_AGENT,
    }
    if encoded is not None:
        headers["Content-Type"] = "application/json; charset=utf-8"

    request = Request(url, data=encoded, headers=headers, method=method)
    started = time.monotonic()
    raw = b""
    status = 0
    try:
        with urlopen(request, timeout=timeout) as response:
            status = int(response.status)
            raw = response.read()
    except HTTPError as exc:
        status = int(exc.code)
        raw = exc.read()
    except (URLError, TimeoutError, OSError) as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        raise MonitorError(f"request failed after {elapsed_ms}ms: {url}: {exc}") from exc

    elapsed_ms = int((time.monotonic() - started) * 1000)
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise MonitorError(
            f"non-JSON response from {url}: HTTP {status}, {len(raw)} bytes"
        ) from exc
    if not isinstance(payload, dict):
        raise MonitorError(f"expected JSON object from {url}, got {type(payload).__name__}")
    return status, payload, elapsed_ms


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Production Worker Monitor",
        "",
        f"Generated: `{report['generated_at']}`",
        f"Catalog resources: **{report['catalog_resources']}**",
        f"Overall: **{report['status']}**",
        "",
        "## Runtime summary",
        "",
        f"- AI recommendation mode: `{report.get('ai_mode') or 'unavailable'}`",
        f"- AI recommendation IDs: `{', '.join(report.get('recommendation_ids') or []) or 'none'}`",
        f"- Click-counter entries observed: **{report.get('click_count_entries', 0)}**",
        "- Click API probe is GET-only; this monitor never POSTs or increments click counts.",
        "",
        "## Checks",
        "",
        "| Check | Result | Details |",
        "| --- | --- | --- |",
    ]
    for check in report.get("checks", []):
        result = "PASS" if check.get("ok") else "FAIL"
        details = str(check.get("details", "")).replace("|", "\\|").replace("\n", " ")
        lines.append(f"| `{check.get('name', '')}` | {result} | {details} |")

    warnings = report.get("warnings") or []
    if warnings:
        lines.extend(["", "## Warnings", ""])
        lines.extend(f"- {warning}" for warning in warnings)
    return "\n".join(lines) + "\n"


def run_monitor(timeout: float) -> dict[str, Any]:
    context = validate_local_configuration()
    resource_by_id = context["resource_by_id"]
    presentation_ids = context["presentation_ids"]
    checks: list[dict[str, Any]] = []
    warnings: list[str] = []
    ai_mode: str | None = None
    recommendation_ids: list[str] = []
    click_count_entries = 0

    def add_check(name: str, ok: bool, details: str) -> None:
        checks.append({"name": name, "ok": bool(ok), "details": details})

    try:
        status, payload, elapsed = request_json(
            health_url(context["ai_endpoint"]), timeout=timeout
        )
        ok = (
            status == 200
            and payload.get("ok") is True
            and payload.get("service") == "qookey-ai-resource-recommender"
        )
        add_check(
            "ai_health",
            ok,
            f"HTTP {status}, {elapsed}ms, service={payload.get('service')}, version={payload.get('version')}",
        )
    except MonitorError as exc:
        add_check("ai_health", False, str(exc))

    try:
        status, payload, elapsed = request_json(
            health_url(context["click_endpoint"]), timeout=timeout
        )
        ok = (
            status == 200
            and payload.get("ok") is True
            and payload.get("service") == "qookey-resource-clicks"
        )
        add_check(
            "click_health",
            ok,
            f"HTTP {status}, {elapsed}ms, service={payload.get('service')}",
        )
    except MonitorError as exc:
        add_check("click_health", False, str(exc))

    try:
        status, payload, elapsed = request_json(
            context["click_endpoint"], timeout=timeout
        )
        counts = payload.get("counts")
        valid_counts = isinstance(counts, dict) and all(
            isinstance(key, str)
            and isinstance(value, int)
            and not isinstance(value, bool)
            and value >= 0
            for key, value in (counts.items() if isinstance(counts, dict) else [])
        )
        ok = status == 200 and payload.get("ok") is True and valid_counts
        click_count_entries = len(counts) if isinstance(counts, dict) else 0
        add_check(
            "click_read_only_api",
            ok,
            f"HTTP {status}, {elapsed}ms, count_entries={click_count_entries}, method=GET",
        )
        if isinstance(counts, dict):
            unknown_count_ids = sorted(set(counts) - set(resource_by_id))
            if unknown_count_ids:
                warnings.append(
                    "Click storage contains historical/non-current IDs; counts were preserved as required: "
                    + ", ".join(unknown_count_ids[:12])
                )
    except MonitorError as exc:
        add_check("click_read_only_api", False, str(exc))

    try:
        status, payload, elapsed = request_json(
            context["ai_endpoint"],
            method="POST",
            body={"query": SEMANTIC_QUERY},
            timeout=timeout,
        )
        ai_mode = str(payload.get("mode") or "")
        recommendations = payload.get("recommendations")
        recommendations = recommendations if isinstance(recommendations, list) else []
        recommendation_ids = [
            str(item.get("id"))
            for item in recommendations
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        ]

        contract_ok = (
            status == 200
            and payload.get("ok") is True
            and ai_mode in {"ai", "fallback"}
            and 1 <= len(recommendations) <= 4
        )
        add_check(
            "ai_recommend_contract",
            contract_ok,
            f"HTTP {status}, {elapsed}ms, mode={ai_mode or 'missing'}, recommendations={len(recommendations)}",
        )

        unknown_ids = sorted(set(recommendation_ids) - set(resource_by_id))
        add_check(
            "ai_recommend_catalog_ids",
            not unknown_ids and len(recommendation_ids) == len(recommendations),
            "all recommendation IDs resolve to current catalog"
            if not unknown_ids and len(recommendation_ids) == len(recommendations)
            else f"unknown/missing IDs: {unknown_ids}",
        )

        semantic_hits = [
            resource_id for resource_id in recommendation_ids if resource_id in presentation_ids
        ]
        add_check(
            "ai_recommend_semantics",
            bool(semantic_hits),
            "presentation/PPTX match=" + (", ".join(semantic_hits) if semantic_hits else "none"),
        )

        if ai_mode == "fallback" or payload.get("intent_mode") == "fallback":
            warnings.append(
                "AI request completed through fallback/degraded mode; service remained usable but model inference should be watched."
            )
    except MonitorError as exc:
        add_check("ai_recommend_contract", False, str(exc))
        add_check("ai_recommend_catalog_ids", False, "recommendation response unavailable")
        add_check("ai_recommend_semantics", False, "recommendation response unavailable")

    overall_ok = all(check.get("ok") for check in checks)
    return {
        "schema_version": "0.1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "PASS" if overall_ok else "FAIL",
        "catalog_resources": len(resource_by_id),
        "semantic_query": SEMANTIC_QUERY,
        "ai_mode": ai_mode,
        "recommendation_ids": recommendation_ids,
        "click_count_entries": click_count_entries,
        "checks": checks,
        "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--timeout", type=float, default=20.0)
    args = parser.parse_args()

    try:
        context = validate_local_configuration()
    except MonitorError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if args.validate_only:
        print(
            "Production worker monitor validation PASS: "
            f"catalog_resources={len(context['resource_by_id'])}, "
            f"semantic_candidates={len(context['presentation_ids'])}"
        )
        return 0

    report = run_monitor(args.timeout)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = REPORT_DIR / "production-worker-monitor.json"
    md_path = REPORT_DIR / "production-worker-monitor.md"
    json_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    md_path.write_text(markdown_report(report), encoding="utf-8")
    print(markdown_report(report), end="")
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
