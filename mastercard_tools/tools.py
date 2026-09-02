"""Executable Omnigent tools backed exclusively by deterministic modeled data."""

from __future__ import annotations

import json
import re
import time
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen


_METADATA = {
    "data_classification": "SYNTHETIC_MODELED_DATA",
    "dataset_version": "2026.09",
    "observed_at": "2026-09-02T09:20:00Z",
}

_RELEASE_ID = "REL-DEMO-2026-09-02-01"
_CANDIDATE_URL = f"http://127.0.0.1:8015/candidates/{_RELEASE_ID}"
_STAGE_URL = f"http://127.0.0.1:8015/releases/{_RELEASE_ID}"


def _result(scenario_id: str, **payload: Any) -> dict[str, Any]:
    return {**_METADATA, "scenario_id": scenario_id, **payload}


def compare_authorization_health(
    regions: list[str], exclude_planned_maintenance: bool = True
) -> dict[str, Any]:
    """Return deterministic synthetic authorization health for known regions."""
    catalog = {
        "DE": {"approval_rate": 91.8, "baseline": 96.3, "latency_ms": 184, "maintenance": False},
        "FR": {"approval_rate": 88.1, "baseline": 95.7, "latency_ms": 191, "maintenance": False},
        "IE": {"approval_rate": 96.5, "baseline": 96.4, "latency_ms": 102, "maintenance": True},
        "NL": {"approval_rate": 96.1, "baseline": 96.0, "latency_ms": 109, "maintenance": False},
        "ES": {"approval_rate": 95.4, "baseline": 95.6, "latency_ms": 121, "maintenance": False},
    }
    normalized = [region.strip().upper() for region in regions]
    if not normalized or len(normalized) > 5:
        raise ValueError("regions must contain between one and five entries")
    unknown = sorted(set(normalized) - catalog.keys())
    if unknown:
        raise ValueError(f"no modeled data for region(s): {', '.join(unknown)}")
    rows = [
        {"region": region, **catalog[region]}
        for region in normalized
        if not (exclude_planned_maintenance and catalog[region]["maintenance"])
    ]
    return _result(
        "network-eu-auth-dip-001",
        regions=rows,
        likely_fault_domain="issuer-routing corridor configuration",
        confidence=0.82,
        excluded_planned_maintenance=exclude_planned_maintenance,
    )


def assess_fraud_cluster(merchant_id: str, window_minutes: int = 60) -> dict[str, Any]:
    """Assess one explicitly synthetic merchant cluster."""
    if merchant_id != "DEMO-M-204":
        raise ValueError("merchant_id must reference the modeled merchant DEMO-M-204")
    if not 5 <= window_minutes <= 1440:
        raise ValueError("window_minutes must be between 5 and 1440")
    return _result(
        "fraud-card-testing-004",
        merchant_id=merchant_id,
        window_minutes=window_minutes,
        attempted_transactions=1842,
        unique_accounts=1631,
        low_value_ratio=0.91,
        risk="high",
        recommendation="prepare an approval-gated merchant control review",
    )


def check_tokenization_readiness(requestor_id: str) -> dict[str, Any]:
    """Return deterministic certification gates for one synthetic requestor."""
    if requestor_id != "TR-DEMO-781":
        raise ValueError("requestor_id must reference the modeled requestor TR-DEMO-781")
    return _result(
        "tokenization-launch-003",
        requestor_id=requestor_id,
        passed_gates=["cryptogram validation", "lifecycle events", "token assurance"],
        blocked_gates=["issuer rollback rehearsal"],
        gates=[
            {"gate": "cryptogram validation", "status": "passed", "owner": "Token Engineering"},
            {"gate": "lifecycle events", "status": "passed", "owner": "Digital Payments QA"},
            {"gate": "token assurance", "status": "passed", "owner": "Risk Product"},
            {"gate": "issuer rollback rehearsal", "status": "blocked", "owner": "Issuer Integration"},
        ],
        readiness="conditional",
        recommendation="NO_GO_PENDING_OWNER_APPROVAL",
        proposed_launch_window="2026-09-08T22:00:00Z",
    )


def investigate_settlement_variance(batch_id: str) -> dict[str, Any]:
    """Return deterministic evidence for one synthetic settlement batch."""
    if batch_id != "SET-DEMO-042":
        raise ValueError("batch_id must reference the modeled batch SET-DEMO-042")
    return _result(
        "settlement-variance-002",
        batch_id=batch_id,
        expected_amount_eur=12_884_112.43,
        reported_amount_eur=12_861_940.18,
        variance_eur=-22_172.25,
        cause="late issuer adjustment file",
        reconciliation_status="pending next file window",
    )


def lookup_control_evidence(control_id: str) -> dict[str, Any]:
    """Return deterministic control evidence for one synthetic control."""
    if control_id != "CTRL-DEMO-17":
        raise ValueError("control_id must reference the modeled control CTRL-DEMO-17")
    return _result(
        "compliance-evidence-006",
        control_id=control_id,
        control="dual approval for high-impact operational changes",
        evidence=["modeled approval log", "modeled change ticket", "modeled rollback record"],
        status="one evidence item nearing review date",
        legal_advice=False,
    )


def preview_operational_action(action: str, target: str) -> dict[str, Any]:
    """Create an inert action preview; never invoke a real external system."""
    allowed = {"route_traffic", "restrict_merchant", "advance_launch", "open_review"}
    if action not in allowed:
        raise ValueError(f"action must be one of: {', '.join(sorted(allowed))}")
    if not target or len(target) > 100:
        raise ValueError("target must contain between 1 and 100 characters")
    return _result(
        "operational-preview-001",
        action=action,
        target=target,
        execution_status="NOT_EXECUTED",
        approval_required=True,
        next_step="human owner must review and execute in a real authorized system",
    )


def watch_release_pipeline(release_id: str) -> dict[str, Any]:
    """Return a modeled pipeline watch result that stops before release finish."""
    _require_release(release_id)
    # The bounded delay makes Omnigent's real async-dispatch lifecycle visible
    # without contacting a CI/CD service or slowing the demo materially.
    time.sleep(0.35)
    _notify_release_surface("watch")
    return _result(
        "release-pipeline-001",
        release_id=release_id,
        pipeline_status="AWAITING_HUMAN_APPROVAL",
        candidate_url=_CANDIDATE_URL,
        steps=[
            {"name": "build", "status": "passed", "duration_seconds": 18},
            {"name": "unit-and-contract-tests", "status": "passed", "duration_seconds": 31},
            {"name": "package-candidate", "status": "passed", "duration_seconds": 12},
            {"name": "stage-readiness", "status": "passed", "duration_seconds": 7},
        ],
        finish_action="NOT_EXECUTED",
        approval_required=True,
        next_step="ask an authorized employee whether to run release finish",
    )


def finish_release_pipeline(release_id: str, approval_event_id: str) -> dict[str, Any]:
    """Finish a modeled release using the later signed Buzz event as evidence."""
    _require_release(release_id)
    if re.fullmatch(r"[0-9a-fA-F]{64}", approval_event_id) is None:
        raise ValueError("approval_event_id must be a 64-character signed Buzz event id")
    _notify_release_surface("finish", {"approvalEventId": approval_event_id.lower()})
    return _result(
        "release-finish-001",
        release_id=release_id,
        approval_event_id=approval_event_id.lower(),
        deployment_status="DEPLOYED_TO_STAGE",
        environment="stage",
        stage_url=_STAGE_URL,
        rollback_status="ready",
        production_deployed=False,
    )


def verify_stage_deployment(release_id: str, stage_url: str) -> dict[str, Any]:
    """Verify only the local modeled stage surface for the known release."""
    _require_release(release_id)
    if stage_url != _STAGE_URL:
        raise ValueError(f"stage_url must be the modeled stage URL {_STAGE_URL}")
    return _result(
        "release-stage-verification-001",
        release_id=release_id,
        stage_url=stage_url,
        environment="stage",
        health="healthy",
        checks=[
            {"name": "http-health", "status": "passed", "latency_ms": 42},
            {"name": "configuration", "status": "passed"},
            {"name": "rollback-marker", "status": "passed"},
        ],
        production_traffic=False,
    )


def _require_release(release_id: str) -> None:
    if release_id != _RELEASE_ID:
        raise ValueError(f"release_id must reference the modeled release {_RELEASE_ID}")


def _notify_release_surface(action: str, payload: dict[str, str] | None = None) -> None:
    """Advance the loopback-only visual release state when the POC is running."""
    request = Request(
        f"http://127.0.0.1:8015/api/releases/{_RELEASE_ID}/{action}",
        data=json.dumps(payload or {}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=1.0) as response:
            response.read(1)
    except (URLError, TimeoutError):
        # The deterministic tool contract remains usable in unit tests and when
        # the optional visual surface is not running.
        return
