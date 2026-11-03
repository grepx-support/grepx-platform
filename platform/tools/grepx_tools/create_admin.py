"""Create (or promote) an admin through the services: person record -> credentials -> admin role (a saga).

    scripts/run.sh admin EMAIL PASSWORD NAME PHONE

The person record is the deployment's (the product deployment file  person: {table, service, requests, key});
the admin role name comes from config `roles:`. Nothing product-specific lives here.
"""
import grepx_contracts as gc
import sys

from grepx_auth import SecretBox
from grepx_service import RequestClient, Saga, SagaRunner, Step
from grepx_common import Roles
from nexus_api import NexusClient
from grepx_config import load_config

from log import say
from workspace import ROOT


def person_config(cfg) -> dict:
    person = cfg.get("person") or {}
    missing = [k for k in ("table", "service", "requests", "key") if not person.get(k)]
    if missing:
        raise SystemExit(f"the deployment file (grepx.workspace.yaml deployment:) person: needs {', '.join(missing)}")
    return person


def main(email: str, password: str, name: str, phone: str, project: str = "") -> int:
    cfg = load_config(ROOT / "config")
    person, admin_role = person_config(cfg), Roles.of(cfg).admin
    client = NexusClient("create-admin")
    existing = client.select(person["table"], f"email = '{email.lower()}' AND status = 'ACCEPTED'")
    create = Step("person", person["requests"], person["service"],
                  lambda s: {"action": "CREATE", "name": name, "email": email, "phone": phone, "source": "staff"})
    saga = Saga("create-admin", ([] if existing else [create]) + [
        Step("login", gc.auth.REQUESTS, gc.auth.SERVICE, lambda s: {"action": "SET_PASSWORD", "user_id": s["user_id"](s), "email": email,
                                                                  "password_enc": SecretBox.from_env().seal(password)}),
        Step("role", gc.access.REQUESTS, gc.access.SERVICE, lambda s: {"action": "SET_ROLE", "user_id": s["user_id"](s), "role": admin_role}),
    ])
    outcome = SagaRunner(RequestClient(client, "create-admin")).run(
        saga, {"user_id": lambda s: existing[0].key if existing else s["person"][person["key"]]})
    say("OK", "admin", "admin ready") if outcome.ok else say("ERROR", "admin", f"failed at {outcome.failed_step}: {outcome.reason}")
    return 0 if outcome.ok else 1


if __name__ == "__main__":
    if len(sys.argv) < 5:
        raise SystemExit(__doc__)
    sys.exit(main(*sys.argv[1:6]))
