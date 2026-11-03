# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Data migrations for the Nexus database, described as data (platform/tools/migrations/<name>.yaml).

    scripts/run.sh migrate                       list the migrations
    scripts/run.sh migrate NAME [--dry-run]      apply one (stop the services and take a backup first)

A migration renames tables, services, fields, values and row keys in nexus_rows and outbox - see the YAML files for
the vocabulary. Applying one twice changes nothing. Rows whose new key already exists are left alone and reported.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import yaml
from nexus_api.codec.values import JSON_MARK, decode_value, encode_value

sys.path.insert(0, str(Path(__file__).resolve().parent))
from log import say  # noqa: E402

from root import ROOT  # noqa: E402  (the workspace, see root.py)
MIGRATIONS = ROOT / "platform" / "tools" / "migrations"
NEXUS_DB = ROOT / "platform" / "nexus-server" / "bin" / "nexus_data.db"
FIELD_SEP, NAME_SEP = "\x1f", "\x1e"


def decode(text: str) -> list[list[str]]:
    """'name\\x1etype:value' joined by \\x1f -> [[name, 'type:value'], …] (order kept)."""
    return [part.split(NAME_SEP, 1) for part in text.split(FIELD_SEP) if NAME_SEP in part] if text else []


def encode(fields: list[list[str]]) -> str:
    return FIELD_SEP.join(f"{n}{NAME_SEP}{v}" for n, v in fields)


class Migration:
    def __init__(self, spec: dict):
        self.services = spec.get("services") or {}
        self.tables = spec.get("tables") or {}
        renamed = spec.get("fields") or {}
        self.field_tables, self.field_map = set(renamed.get("in") or ()), renamed.get("rename") or {}
        self.table_fields = spec.get("table_fields") or {}
        self.values = spec.get("values") or {}
        self.keys = spec.get("keys") or {}
        self.json_keys = spec.get("json_keys") or {}
        self.text = spec.get("text") or {}
        self.drop = set(spec.get("drop_tables") or ())

    def table(self, name: str) -> str:
        return self.tables.get(name, name)

    def key(self, table: str, key: str) -> str:
        return (self.keys.get(table) or {}).get(key, key)

    def fields(self, table: str, text: str) -> str:
        """The row's encoded fields in the new vocabulary (`table` is the new name)."""
        renames = {**(self.field_map if table in self.field_tables else {}), **(self.table_fields.get(table) or {})}
        out = []
        for name, typed in decode(text):
            name = renames.get(name, name)
            typed = self._value(table, name, typed)
            out.append([name, typed])
        return encode(out)

    def _value(self, table: str, name: str, typed: str) -> str:
        kind, _, value = typed.partition(":")
        if kind != "s":
            return typed
        if name in ("table_name",) or name.endswith("_table"):
            value = self.table(value)
        value = self.services.get(value, value)
        for old, new in self.services.items():
            if value.startswith(old + "/"):
                value = new + value[len(old):]
        value = ((self.values.get(table) or {}).get(name) or {}).get(value, value)
        keys = (self.json_keys.get(table) or {}).get(name)
        if keys and value.startswith(JSON_MARK):
            value = encode_value(rename_keys(decode_value(f"s:{value}"), keys))[2:]
        for old, new in (self.text.get(table) or {}).items():
            value = value.replace(old, new)
        return f"{kind}:{value}"


def rename_keys(doc, keys: dict):
    if isinstance(doc, dict):
        return {keys.get(k, k): v for k, v in doc.items()}
    return doc


def apply(db: Path, migration: Migration, dry_run: bool = False) -> dict:
    con = sqlite3.connect(str(db))
    counts = {"rows": 0, "outbox": 0, "dropped": 0, "conflicts": []}
    try:
        for table in migration.drop:
            counts["dropped"] += con.execute("DELETE FROM nexus_rows WHERE table_name = ?", (table,)).rowcount
        for table, key, text in con.execute("SELECT table_name, row_key, fields FROM nexus_rows").fetchall():
            new_table = migration.table(table)
            new_key, new_text = migration.key(new_table, key), migration.fields(new_table, text)
            if (new_table, new_key, new_text) == (table, key, text):
                continue
            if (new_table, new_key) != (table, key) and con.execute(
                    "SELECT 1 FROM nexus_rows WHERE table_name = ? AND row_key = ?", (new_table, new_key)).fetchone():
                counts["conflicts"].append(f"{table}/{key} -> {new_table}/{new_key}")
                continue
            con.execute("UPDATE nexus_rows SET table_name = ?, row_key = ?, fields = ? WHERE table_name = ? AND row_key = ?",
                        (new_table, new_key, new_text, table, key))
            counts["rows"] += 1
        for row_id, table, txn, src, dst, text in con.execute(
                "SELECT id, table_name, transaction_id, from_service, to_service, fields FROM outbox").fetchall():
            new_table = migration.table(table)
            new = (new_table, migration.key(new_table, txn), migration.services.get(src, src), migration.services.get(dst, dst),
                   migration.fields(new_table, text))
            if new != (table, txn, src, dst, text):
                con.execute("UPDATE outbox SET table_name = ?, transaction_id = ?, from_service = ?, to_service = ?, fields = ? WHERE id = ?",
                            (*new, row_id))
                counts["outbox"] += 1
        con.rollback() if dry_run else con.commit()
    finally:
        con.close()
    return counts


def load(name: str) -> Migration:
    path = MIGRATIONS / (name if name.endswith(".yaml") else f"{name}.yaml")
    if not path.exists():
        raise SystemExit(f"no migration {name} (see scripts/run.sh migrate)")
    return Migration(yaml.safe_load(path.read_text(encoding="utf-8")) or {})


def main(argv: list[str]) -> int:
    names = [a for a in argv if not a.startswith("--")]
    if not names:
        for f in sorted(MIGRATIONS.glob("*.yaml")):
            print(f.stem)
        return 0
    db = Path(next((a.split("=", 1)[1] for a in argv if a.startswith("--db=")), NEXUS_DB))
    if not db.exists():
        say("ERROR", "migrate", f"no Nexus database at {db}")
        return 1
    dry = "--dry-run" in argv
    counts = apply(db, load(names[0]), dry_run=dry)
    say("OK", "migrate", f"{names[0]}{' (dry run)' if dry else ''}: {counts['rows']} rows, {counts['outbox']} outbox entries rewritten, "
                         f"{counts['dropped']} dropped")
    for c in counts["conflicts"]:
        say("WARN", "migrate", f"kept (new key already exists): {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
