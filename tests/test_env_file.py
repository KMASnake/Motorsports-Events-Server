import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from app.infrastructure.env_file import (  # noqa: E402
    parse_env_text,
    render_env_updates,
    write_env_updates,
)


class EnvFileTests(unittest.TestCase):
    def test_parser_decodes_quoted_values(self):
        values = parse_env_text(
            'PROJECT_NAME="Motorsports Events"\nLOG_LEVEL=INFO\n'
        )

        self.assertEqual(values["PROJECT_NAME"], "Motorsports Events")
        self.assertEqual(values["LOG_LEVEL"], "INFO")

    def test_update_preserves_comments_and_unknown_values(self):
        original = (
            "# Configuration\n"
            "PROJECT_NAME=Old\n"
            "UNKNOWN_SETTING=preserved\n"
        )
        rendered = render_env_updates(
            original,
            {"PROJECT_NAME": "New Project", "SYNC_SEASON": "2027"},
        )

        self.assertIn("# Configuration", rendered)
        self.assertIn('PROJECT_NAME="New Project"', rendered)
        self.assertIn("UNKNOWN_SETTING=preserved", rendered)
        self.assertIn("SYNC_SEASON=2027", rendered)

    def test_write_keeps_restrictive_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text("LOG_LEVEL=INFO\n", encoding="utf-8")

            write_env_updates(path, {"LOG_LEVEL": "WARNING"})

            self.assertEqual(
                path.read_text(encoding="utf-8"),
                "LOG_LEVEL=WARNING\n",
            )
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)


if __name__ == "__main__":
    unittest.main()
