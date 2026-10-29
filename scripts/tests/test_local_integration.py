"""Verify failure propagation, staged Python and preservation of partial staging."""

import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
import check_maintenance  # noqa: E402
from check_docs import SKILLS  # noqa: E402


class RunnerTests(unittest.TestCase):
    def test_failed_check_blocks_later_steps(self):
        with (
            patch.object(sys, "argv", ["check_maintenance.py"]),
            patch.object(
                check_maintenance, "commands", return_value=[["first"], ["later"]]
            ),
            patch.object(
                check_maintenance.subprocess,
                "run",
                return_value=subprocess.CompletedProcess(["first"], 7),
            ) as run,
        ):
            self.assertEqual(check_maintenance.main(), 7)
            self.assertEqual(run.call_count, 1)

    def test_missing_dependency_returns_failure(self):
        with (
            patch.object(sys, "argv", ["check_maintenance.py"]),
            patch.object(check_maintenance.shutil, "which", return_value=None),
        ):
            self.assertEqual(check_maintenance.main(), 1)


class StagedPythonTests(unittest.TestCase):
    def test_staged_error_cannot_be_hidden_by_unstaged_fix(self):
        with tempfile.TemporaryDirectory(prefix="partial-staging-") as folder:
            root = Path(folder)

            def git(*args):
                return subprocess.check_output(["git", "-C", str(root), *args])

            git("init", "-q")
            git("config", "user.name", "Fixture")
            git("config", "user.email", "fixture@example.invalid")
            git("config", "core.autocrlf", "false")
            shutil.copytree(
                SCRIPTS, root / "scripts", ignore=shutil.ignore_patterns("__pycache__")
            )
            shutil.copy2(SCRIPTS.parent / "ruff.toml", root / "ruff.toml")
            (root / "scripts/doc-policy.json").write_text(
                json.dumps({"version": 1, "hard_limits": {}, "soft_limits": []}),
                encoding="utf-8",
            )
            (root / "tests").mkdir()
            (root / ".agents/notes").mkdir(parents=True)
            (root / ".agents/notes/README.md").write_text("# Notes\n", encoding="utf-8")
            for name in SKILLS:
                skill = root / ".agents/skills" / name
                (skill / "agents").mkdir(parents=True)
                (skill / "SKILL.md").write_text(
                    f"---\nname: {name}\ndescription: fixture\n---\n", encoding="utf-8"
                )
                (skill / "agents/openai.yaml").write_text(
                    "interface:\n  display_name: fixture\n  short_description: fixture\n",
                    encoding="utf-8",
                )
            (root / "README.md").write_text("# Fixture\n", encoding="utf-8")
            page = root / "tests/fixture.py"
            page.write_text("print('valid')\n", encoding="utf-8")
            git("add", ".")
            git("commit", "-qm", "baseline")
            page.write_text("print(undefined_name)\n", encoding="utf-8")
            git("add", "tests/fixture.py")
            page.write_text("print('unstaged fix')\n", encoding="utf-8")
            index_before = git("write-tree")
            bytes_before = page.read_bytes()

            def check():
                return subprocess.run(
                    [
                        sys.executable,
                        "-X",
                        "utf8",
                        str(root / "scripts/staged_checks.py"),
                    ],
                    cwd=root,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    check=False,
                )

            result = check()
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("F821", result.stdout, result.stdout + result.stderr)
            self.assertEqual(git("write-tree"), index_before)
            self.assertEqual(page.read_bytes(), bytes_before)
            git("add", "tests/fixture.py")
            page.write_text("print(another_unstaged_error)\n", encoding="utf-8")
            index_before = git("write-tree")
            bytes_before = page.read_bytes()
            result = check()
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(git("write-tree"), index_before)
            self.assertEqual(page.read_bytes(), bytes_before)


class NotesTests(unittest.TestCase):
    def test_state_mismatch_and_blank_note_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / ".agents/notes/implemented/process/2026-10-29-fixture.md"
            path.parent.mkdir(parents=True)
            for status, body, success in (
                ("implemented", "Decision and its reason.", True),
                ("proposed", "Decision and its reason.", False),
                ("implemented", "", False),
            ):
                path.write_text(
                    f"# Agent Note: Fixture\n\nStatus: {status}\n\n{body}\n",
                    encoding="utf-8",
                )
                result = subprocess.run(
                    [
                        sys.executable,
                        "-X",
                        "utf8",
                        str(SCRIPTS / "notes_guard.py"),
                        "--root",
                        str(root),
                    ],
                    capture_output=True,
                    check=False,
                )
                self.assertEqual(result.returncode == 0, success)

    def test_current_hash_mismatch_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            name = "archived/process/2026-10-29-fixture.md"
            path = root / ".agents/notes" / name
            path.parent.mkdir(parents=True)
            path.write_text(
                "# Agent Note: Fixture\n\nStatus: implemented\nArchived: 2026-10-29\n\nOriginal.\n",
                encoding="utf-8",
            )
            manifest = root / ".agents/notes/archive-seals.json"
            manifest.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "files": {name: hashlib.sha256(path.read_bytes()).hexdigest()},
                    }
                ),
                encoding="utf-8",
            )
            path.write_text(
                path.read_text(encoding="utf-8") + "Changed.\n", encoding="utf-8"
            )
            result = subprocess.run(
                [
                    sys.executable,
                    "-X",
                    "utf8",
                    str(SCRIPTS / "notes_guard.py"),
                    "--root",
                    str(root),
                ],
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
