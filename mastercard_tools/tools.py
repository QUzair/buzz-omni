"""Executable Omnigent tools backed exclusively by deterministic modeled data."""

from __future__ import annotations

from typing import Any


_METADATA = {
    "data_classification": "SYNTHETIC_MODELED_DATA",
    "dataset_version": "2026.09",
    "observed_at": "2026-09-02T09:20:00Z",
}


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
