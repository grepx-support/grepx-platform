"""scripts/run.sh nexus-check - ask the running Nexus server which wire values it accepts.

Sends one INSERT per sample (raw wire text) to table nexus_check and prints OK / the server's answer.
The first block is what this repo's codec sends today; the second block shows the formats to avoid.
"""
import sys
import uuid

from nexus_api import NexusClient
from nexus_api.codec.values import encode_value

SENT_TODAY = {
    "text": "hello world", "timestamp": "2026-10-31T13:20:00+00:00", "int": 42, "float": 2.5, "bool": True,
    "none": None, "empty list": [], "list": [1, 2], "object": {"a": [1, "b"]}, "text with ;=newline": "a;b=c\nd",
    "percent": "100%", "unicode": "Café ✓",
}
RAW_OTHERS = {"l:[] (old)": "l:[]", "l:[1,2] (old)": "l:[1,2]", "u: (old)": "u:a%3Bb", "j: (old)": "j:%7B%7D"}


def main() -> int:
    client = NexusClient("nexus-check")
    failed = 0

    def send(label: str, wire: str, expect_ok: bool) -> None:
        nonlocal failed
        key = uuid.uuid4().hex
        with client._lock:
            conn = client._get_conn()
            conn.send_line(f"INSERT nexus_check {key} status=s:NEW;v={wire}")
            answer = conn.recv_line() or "(no answer)"
        ok = answer.startswith("OK")
        if expect_ok and not ok:
            failed += 1
        print(f"  {'OK ' if ok else 'ERR'}  {label:<22} {wire[:50]:<52} {'' if ok else answer}")

    print("values this codec sends:")
    for label, value in SENT_TODAY.items():
        send(label, encode_value(value), True)
    print("older formats (expected to fail on the C++ server):")
    for label, wire in RAW_OTHERS.items():
        send(label, wire, False)
    print("all current formats accepted" if not failed else f"{failed} current format(s) rejected - send this output")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
