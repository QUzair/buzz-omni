import unittest

from mastercard_tools.tools import (
    assess_fraud_cluster,
    compare_authorization_health,
    preview_operational_action,
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

    def test_operational_actions_are_preview_only(self) -> None:
        result = preview_operational_action("route_traffic", "eu-central")

        self.assertEqual(result["execution_status"], "NOT_EXECUTED")
        self.assertTrue(result["approval_required"])
        self.assertNotIn("credential", str(result).lower())


if __name__ == "__main__":
    unittest.main()
