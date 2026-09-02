import unittest
from unittest.mock import patch

from mastercard_tools.tools import (
    assess_fraud_cluster,
    check_tokenization_readiness,
    compare_authorization_health,
    investigate_settlement_variance,
    lookup_control_evidence,
    preview_operational_action,
    finish_release_pipeline,
    verify_stage_deployment,
    watch_release_pipeline,
)


class ModeledToolsTest(unittest.TestCase):
    def test_authorization_health_is_deterministic_and_labeled(self) -> None:
        first = compare_authorization_health(["DE", "FR"])
        second = compare_authorization_health(["DE", "FR"])

        self.assertEqual(first, second)
        self.assertEqual(first["data_classification"], "SYNTHETIC_MODELED_DATA")
        self.assertEqual(first["scenario_id"], "network-eu-auth-dip-001")
        self.assertEqual(len(first["regions"]), 2)

    def test_unknown_fraud_merchant_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "modeled merchant"):
            assess_fraud_cluster("real-merchant-id")

    def test_modeled_scenario_ids_match_the_seeded_buzz_conversations(self) -> None:
        fraud = assess_fraud_cluster("DEMO-M-204")
        tokenization = check_tokenization_readiness("TR-DEMO-781")
        settlement = investigate_settlement_variance("SET-DEMO-042")
        compliance = lookup_control_evidence("CTRL-DEMO-17")

        self.assertEqual(fraud["merchant_id"], "DEMO-M-204")
        self.assertEqual(tokenization["requestor_id"], "TR-DEMO-781")
        self.assertEqual(tokenization["gates"][-1]["owner"], "Issuer Integration")
        self.assertEqual(settlement["batch_id"], "SET-DEMO-042")
        self.assertEqual(compliance["control_id"], "CTRL-DEMO-17")

    def test_operational_actions_are_preview_only(self) -> None:
        result = preview_operational_action("route_traffic", "eu-central")

        self.assertEqual(result["execution_status"], "NOT_EXECUTED")
        self.assertTrue(result["approval_required"])
        self.assertNotIn("credential", str(result).lower())

    def test_release_pipeline_waits_for_a_separate_human_finish_approval(self) -> None:
        with patch("mastercard_tools.tools._notify_release_surface") as notify:
            result = watch_release_pipeline("REL-DEMO-2026-09-02-01")

        self.assertEqual(result["pipeline_status"], "AWAITING_HUMAN_APPROVAL")
        self.assertEqual(result["finish_action"], "NOT_EXECUTED")
        self.assertEqual(
            result["candidate_url"],
            "http://127.0.0.1:8015/candidates/REL-DEMO-2026-09-02-01",
        )
        self.assertTrue(all(step["status"] == "passed" for step in result["steps"]))
        notify.assert_called_once_with("watch")

    def test_release_finish_records_the_signed_approval_event_and_stage_url(self) -> None:
        approval_event_id = "a" * 64
        with patch("mastercard_tools.tools._notify_release_surface") as notify:
            result = finish_release_pipeline("REL-DEMO-2026-09-02-01", approval_event_id)

        self.assertEqual(result["deployment_status"], "DEPLOYED_TO_STAGE")
        self.assertEqual(result["approval_event_id"], approval_event_id)
        self.assertEqual(
            result["stage_url"],
            "http://127.0.0.1:8015/releases/REL-DEMO-2026-09-02-01",
        )
        notify.assert_called_once_with("finish", {"approvalEventId": approval_event_id})

    def test_network_operations_verifies_only_the_modeled_stage_url(self) -> None:
        result = verify_stage_deployment(
            "REL-DEMO-2026-09-02-01",
            "http://127.0.0.1:8015/releases/REL-DEMO-2026-09-02-01",
        )

        self.assertEqual(result["health"], "healthy")
        self.assertEqual(result["environment"], "stage")
        with self.assertRaisesRegex(ValueError, "modeled stage URL"):
            verify_stage_deployment("REL-DEMO-2026-09-02-01", "https://example.com")


if __name__ == "__main__":
    unittest.main()
