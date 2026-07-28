import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from app.domain.session_classification import classify_session  # noqa: E402
from app.domain.sports import sport_display_name  # noqa: E402


class SessionClassificationRegressionTests(unittest.TestCase):
    def test_race_is_a_race(self):
        self.assertEqual(classify_session("race", "Race"), ("race", "race", True))

    def test_sprint_is_a_race(self):
        self.assertEqual(classify_session("sprint", "Sprint"), ("sprint", "race", True))

    def test_superpole_race_is_a_race(self):
        self.assertEqual(
            classify_session("", "Superpole Race"),
            ("superpole_race", "race", True),
        )

    def test_sprint_qualifying_is_not_a_race(self):
        self.assertEqual(
            classify_session("sprint_qualifying", "Sprint Q"),
            ("sprint_qualifying", "non_race", False),
        )

    def test_formula_one_label_is_preserved(self):
        self.assertEqual(sport_display_name("formula-1"), "Formule 1")


if __name__ == "__main__":
    unittest.main()
