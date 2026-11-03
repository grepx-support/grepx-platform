# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Backups for the whole platform: every service's own database, the Nexus database and the uploaded pictures.

    scripts/run.sh backup                 copy everything into BACKUP_DIR, commit, and push when BACKUP_GIT_REMOTE is set
    scripts/run.sh restore <folder>       put a backup back (stop the services first: scripts/run.sh stop)

BACKUP_DIR defaults to ../<repo>-backup. SQLite databases are copied with SQLite's online backup (consistent while the
services run) and every table is also written as readable JSON (tables/<service>/<table>.json). PostgreSQL / MongoDB
services are listed with a hint (use pg_dump / mongodump for those). Daily at 02:00 with cron:
    0 2 * * * cd /path/to/repo && scripts/run.sh backup >> logs/backup.log 2>&1
"""
from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from root import ROOT  # noqa: E402  (the workspace, see root.py)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from log import say  # noqa: E402


class GitError(Exception):
    pass


class GitPublisher:
    """Commits the backup folder and pushes it to a (private!) git repository."""
    def __init__(self, folder: Path, remote: str = "", branch: str = "main"):
        self.dir, self.remote, self.branch = Path(folder), remote, branch

    def prepare(self) -> None:
        if (self.dir / ".git").is_dir():
            return
        if self.remote and not (self.dir.exists() and any(self.dir.iterdir())):
            try:
                self._git("clone", self.remote, str(self.dir), cwd=self.dir.parent)
                return
            except GitError:
                pass                                 # empty / new remote: init below
        self.dir.mkdir(parents=True, exist_ok=True)
        self._git("init", "-q")
        self._git("checkout", "-q", "-B", self.branch)
        if self.remote:
            self._git("remote", "add", "origin", self.remote)

    def publish(self, message: str) -> str:
        if not self._git("config", "user.email", check=False).strip():
            self._git("config", "user.email", "backup@grepx.local")
            self._git("config", "user.name", "GrepX Backup")
        self._git("add", "-A")
        if not self._git("status", "--porcelain").strip():
            return "no changes since the last backup"
        self._git("commit", "-q", "-m", message)
        if not self.remote:
            return "committed locally (set BACKUP_GIT_REMOTE to push)"
        self._git("push", "-q", "-u", "origin", f"HEAD:{self.branch}")
        return f"pushed to {self.remote} ({self.branch})"

    def _git(self, *args, cwd=None, check=True) -> str:
        cwd = Path(cwd or self.dir)
        cwd.mkdir(parents=True, exist_ok=True)
        r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8")
        if check and r.returncode != 0:
            raise GitError((r.stderr or r.stdout).strip())
        return r.stdout


def backup_dir() -> Path:
    return Path(os.environ.get("BACKUP_DIR") or ROOT.parent / f"{ROOT.name}-backup").resolve()


def databases() -> list[tuple[str, str]]:
    """(name, database url) for every registered service with tables, plus Nexus itself."""
    from workspace import registry
    from grepx_store.resolve import database_url
    from grepx_config import load_config
    out = []
    for name, svc in registry().items():
        cfg_dir = svc["path"] / "config"
        if name == "nexus-server" or not (cfg_dir / "config.yaml").exists():
            continue
        cfg = load_config(cfg_dir)
        if cfg.get("tables"):
            out.append((name, database_url(cfg)))
    out.append(("nexus", "sqlite:///" + str(ROOT / "platform" / "nexus-server" / "bin" / "nexus_data.db")))
    return out


def _sqlite_path(url: str) -> Path | None:
    return Path(url[len("sqlite:///"):]) if url.startswith("sqlite:///") and ":memory:" not in url else None


def export_sqlite(name: str, source: Path, out: Path) -> int:
    """Consistent copy (SQLite online backup) + every table as JSON. Returns the number of rows exported."""
    (out / "databases").mkdir(parents=True, exist_ok=True)
    target = out / "databases" / f"{name}.db"
    with sqlite3.connect(source) as src, sqlite3.connect(target) as dst:
        src.backup(dst)
    rows = 0
    tables_dir = out / "tables" / name
    tables_dir.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(target) as db:
        db.row_factory = sqlite3.Row
        for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
            data = [dict(r) for r in db.execute(f'SELECT * FROM "{table}"')]
            for r in data:                            # document stores keep JSON text: write it as JSON
                if isinstance(r.get("doc"), str) and r["doc"][:1] in "{[":
                    r["doc"] = json.loads(r["doc"])
            (tables_dir / f"{table}.json").write_text(json.dumps(data, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
            rows += len(data)
    return rows


def copy_media(out: Path) -> int:
    if os.environ.get("MEDIA_STORAGE", "local") != "local":
        say("WARN", "backup", "pictures are in S3 - back the bucket up with your provider's tools")
        return 0
    src = Path(os.environ.get("UPLOAD_DIR") or ROOT / "data" / "uploads")
    if not src.is_dir():
        return 0
    dst = out / "media"
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("staging"))
    return sum(1 for p in dst.rglob("*") if p.is_file())


def run() -> int:
    out = backup_dir()
    git = GitPublisher(out, os.environ.get("BACKUP_GIT_REMOTE", ""), os.environ.get("BACKUP_BRANCH", "main"))
    try:
        git.prepare()
    except GitError as e:
        say("WARN", "backup", f"git: {e} - writing files only")
        git = None
    total = 0
    for name, url in databases():
        path = _sqlite_path(url)
        if path is None:
            say("WARN", "backup", f"{name}: {url.split('://')[0]} database - back it up with pg_dump / mongodump")
            continue
        if not path.exists():
            say("INFO", "backup", f"{name}: no database yet")
            continue
        n = export_sqlite(name, path, out)
        total += n
        say("OK", "backup", f"{name}: {n} rows")
    files = copy_media(out)
    (out / "BACKUP.json").write_text(json.dumps({"at": datetime.now().isoformat(timespec="seconds"), "rows": total, "pictures": files},
                                                indent=1), encoding="utf-8")
    say("OK", "backup", f"{total} rows, {files} pictures -> {out}")
    if git:
        try:
            say("OK", "backup", git.publish(f"Backup {datetime.now():%Y-%m-%d %H:%M}"))
        except GitError as e:
            say("ERROR", "backup", f"git push failed: {e}")
            return 1
    return 0


def restore(folder: str) -> int:
    from processes import pid_of
    from workspace import registry
    running = [n for n in registry() if pid_of(n)]
    if running:
        say("ERROR", "restore", f"stop the services first (scripts/run.sh stop) - still running: {', '.join(running)}")
        return 1
    src = Path(folder).resolve() / "databases"
    if not src.is_dir():
        say("ERROR", "restore", f"{src} not found - give the backup folder (the one with databases/)")
        return 1
    for name, url in databases():
        path, backup = _sqlite_path(url), src / f"{name}.db"
        if path and backup.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup, path)
            say("OK", "restore", f"{name} <- {backup.name}")
    media = Path(folder).resolve() / "media"
    if media.is_dir() and os.environ.get("MEDIA_STORAGE", "local") == "local":
        dst = Path(os.environ.get("UPLOAD_DIR") or ROOT / "data" / "uploads")
        shutil.copytree(media, dst, dirs_exist_ok=True)
        say("OK", "restore", f"pictures -> {dst}")
    say("OK", "restore", "done - scripts/run.sh start")
    return 0


if __name__ == "__main__":
    sys.exit(restore(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[1] == "restore" else run())
