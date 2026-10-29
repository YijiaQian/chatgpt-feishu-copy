"""Run read-only development checks; leave browser tests and packaging separate."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time


def commands(root: Path, *, staged: bool = False) -> list[list[str]]:
    python = sys.executable
    result = [
        [
            python,
            "-X",
            "utf8",
            str(root / "scripts/check_docs.py"),
            "--root",
            str(root),
        ],
        [
            python,
            "-X",
            "utf8",
            str(root / "scripts/notes_guard.py"),
            "--root",
            str(root),
        ],
        [python, "-m", "ruff", "check", str(root / "scripts"), str(root / "tests")],
    ]
    if not staged:
        npm = shutil.which("npm")
        node = shutil.which("node")
        if not npm or not node:
            raise ValueError("Node.js/npm missing; install Node 22.12+ and run npm ci")
        result.append([npm, "run", "lint:md"])
        result.extend(
            [node, "--check", str(path)]
            for pattern in ("*.js", "tests/*.js")
            for path in sorted(root.glob(pattern))
        )
        result.append([python, "-X", "utf8", "scripts/check_archive.py"])
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parents[1]
    )
    args = parser.parse_args()
    root = args.root.resolve()
    environment = dict(os.environ, PYTHONUTF8="1")
    started = time.perf_counter()
    try:
        for command in commands(root):
            print("+ " + " ".join(command), flush=True)
            outcome = subprocess.run(command, cwd=root, env=environment, check=False)
            if outcome.returncode:
                return outcome.returncode
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(f"Maintenance checks passed in {time.perf_counter() - started:.2f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
