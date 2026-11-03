# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Install: run each service's own setup.sh with progress, timing and a summary."""
from __future__ import annotations

import re
import subprocess
import time

from log import say
from workspace import LOGS, ROOT, env, registry, targets


def setup_all(arg: str, mode: str = "install") -> int:
    """Run each service's own setup.sh (install | reset | db) with progress, timing and a summary; keep going on failure."""
    names = [n for n in targets(arg) if (registry()[n]["path"] / "setup.sh").exists()]
    (LOGS / "setup").mkdir(parents=True, exist_ok=True)
    failed, started = [], time.time()
    say("INFO", "setup", f"{mode} {len(names)} service(s) - each has its own .venv, requirements, database and tables")
    for i, name in enumerate(names, 1):
        t0 = time.time()
        say("INFO", "setup", f"[{i}/{len(names)}] {name}")
        log = LOGS / "setup" / f"{name}.log"
        with open(log, "w", encoding="utf-8") as out:
            proc = subprocess.Popen(["bash", str(registry()[name]["path"] / "setup.sh"), mode], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env(name))
            for line in proc.stdout:
                out.write(line)
                if re.match(r"^\d{4}-\d\d-\d\d ", line):   # the service script's own log lines (already in scripts.log)
                    print(line.rstrip(), flush=True)
            code = proc.wait()
        if code:
            failed.append(name)
            tail = log.read_text(encoding="utf-8", errors="replace").splitlines()[-6:]
            say("ERROR", "setup", f"[{i}/{len(names)}] {name} failed after {time.time() - t0:.0f}s - full output: {log.relative_to(ROOT)}")
            for l in tail:
                say("ERROR", name, re.sub(r"^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d \w+\s+\[[^]]*\] ", "", l.strip()))
        else:
            say("OK", "setup", f"[{i}/{len(names)}] {name} done in {time.time() - t0:.0f}s")
    if failed:
        say("ERROR", "setup", f"failed: {', '.join(failed)} - re-run one with scripts/setup.sh <service> (output in logs/setup/<service>.log)")
    else:
        say("OK", "setup", f"{mode} done for all {len(names)} service(s) in {time.time() - started:.0f}s")
    return 1 if failed else 0
