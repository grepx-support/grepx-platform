# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Process control: start / stop services in the background with pid files, log rotation and port lookups."""
from __future__ import annotations

import os
import signal
import subprocess
import time
from pathlib import Path

from log import say
from nexus import nexus_binary, nexus_port, nexus_up
from workspace import LOGS, ROOT, RUN, env, python_for, registry, targets


def command_for(name: str, path: Path) -> tuple[list[str], Path]:
    """(command, working directory) for a service."""
    if name == "nexus-server":
        return [str(nexus_binary(path))], path    # C++ server: runs from its folder, uses bin/nexus_data.db
    return [python_for(path), str(path / "src" / "main.py")], ROOT


def pid_of(name: str) -> int | None:
    f = RUN / f"{name}.pid"
    if f.exists():
        pid = int(f.read_text())
        try:
            os.kill(pid, 0)
            return pid
        except OSError:
            f.unlink(missing_ok=True)
    if name == "nexus-server":          # started some other way: find whoever listens on the Nexus port
        pid = port_owner(nexus_port())
        if pid:
            RUN.mkdir(exist_ok=True)
            f.write_text(str(pid))     # adopt it, so stop / restart / status work the same
        return pid
    return None


def port_owner(port: int) -> int | None:
    """PID listening on a local TCP port (Linux /proc; lsof elsewhere)."""
    inodes = set()
    for table in ("/proc/net/tcp", "/proc/net/tcp6"):
        try:
            for line in Path(table).read_text().splitlines()[1:]:
                parts = line.split()
                if parts[3] == "0A" and int(parts[1].rsplit(":", 1)[1], 16) == port:   # 0A = LISTEN
                    inodes.add(parts[9])
        except OSError:
            pass
    if inodes:
        for proc in Path("/proc").iterdir():
            if not proc.name.isdigit():
                continue
            try:
                for fd in (proc / "fd").iterdir():
                    if os.readlink(fd) in {f"socket:[{i}]" for i in inodes}:
                        return int(proc.name)
            except OSError:
                continue
        return None
    try:
        out = subprocess.run(["lsof", "-t", f"-iTCP:{port}", "-sTCP:LISTEN"], capture_output=True, text=True).stdout.split()
        return int(out[0]) if out else None
    except (OSError, ValueError):
        return None


def rotate(path: Path, max_bytes: int = 10_000_000, keep: int = 5) -> None:
    if path.exists() and path.stat().st_size > max_bytes:
        for i in range(keep - 1, 0, -1):
            older = path.with_suffix(f".log.{i}")
            if older.exists():
                older.replace(path.with_suffix(f".log.{i + 1}"))
        path.replace(path.with_suffix(".log.1"))


def start(arg: str) -> None:
    RUN.mkdir(exist_ok=True)
    LOGS.mkdir(exist_ok=True)
    (ROOT / "data").mkdir(exist_ok=True)
    for name in targets(arg):
        pid = pid_of(name)
        if pid:
            say("INFO", name, f"already running (pid {pid})")
            continue
        if name == "nexus-server" and nexus_up():
            say("WARN", name, f"port {nexus_port()} answers but its process can't be seen (other user?) - not starting a second one")
            continue
        command, workdir = command_for(name, registry()[name]["path"])
        if name == "nexus-server" and not Path(command[0]).is_file():
            say("ERROR", name, f"{Path(command[0]).relative_to(ROOT)} missing - copy the C++ nexus_server binary there")
            continue
        rotate(LOGS / f"{name}.log")
        extra = {"GREPX_PROJECT": registry()[name]["project"]}
        if name == "nexus-server":   # the C++ server writes its own log file; console copy goes to .console.log
            extra["NEXUS_LOG_PATH"] = str(LOGS / f"{name}.log")
            log = open(LOGS / f"{name}.console.log", "a", encoding="utf-8")
        else:
            log = open(LOGS / f"{name}.log", "a", encoding="utf-8")
        proc = subprocess.Popen(command, cwd=workdir, env={**env(name), **extra},
                                stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        (RUN / f"{name}.pid").write_text(str(proc.pid))
        say("OK", name, f"started pid={proc.pid} log=logs/{name}.log")
        if name == "nexus-server":
            for _ in range(40):
                if nexus_up(0.5):
                    say("OK", name, f"ready on port {nexus_port()}")
                    break
                if proc.poll() is not None:
                    say("ERROR", name, f"exited with code {proc.returncode} - see logs/{name}.log")
                    break
                time.sleep(0.25)
            else:
                say("WARN", name, f"not answering on port {nexus_port()} yet - see logs/{name}.log")


def stop(arg: str) -> None:
    for name in reversed(targets(arg)):
        pid = pid_of(name)
        if not pid:
            if name == "nexus-server" and nexus_up():
                say("WARN", name, f"port {nexus_port()} answers but its process can't be seen (other user?) - stop it as that user")
            continue
        try:
            os.kill(pid, signal.SIGTERM)
            for _ in range(50):                      # up to 5 s for a clean shutdown
                time.sleep(0.1)
                os.kill(pid, 0)
            os.kill(pid, signal.SIGKILL)
            say("WARN", name, f"pid {pid} ignored SIGTERM - killed")
        except ProcessLookupError:
            pass
        except PermissionError:
            say("ERROR", name, f"no permission to stop pid {pid}")
            continue
        (RUN / f"{name}.pid").unlink(missing_ok=True)
        say("OK", name, f"stopped (pid {pid})")
