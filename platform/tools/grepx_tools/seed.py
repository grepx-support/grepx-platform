"""scripts/run.sh seed [project] - load each product's catalogue into the common services (idempotent).

A product declares its catalogue folder in config/projects/<product>.yaml:   catalog: product-services/<product>/catalog
"""
import sys

from grepx_service import RequestClient
from grepx_service.catalog import seed_catalog
from nexus_api import NexusClient

from log import say
from workspace import ROOT, projects


def main(only: str = "") -> int:
    chosen = {name: p for name, p in projects().items() if p.get("catalog") and (not only or name == only)}
    if not chosen:
        say("WARN", "seed", "no project declares catalog: in config/projects/*.yaml")
        return 1
    client = NexusClient("catalog-seed")
    requests, failed = RequestClient(client, "catalog-seed"), []
    for name, project in chosen.items():
        results = seed_catalog(requests, ROOT / project["catalog"])
        failed += [f"{name}/{k}" for k, ok in results.items() if not ok]
        say("OK", "seed", f"{name}: {sum(results.values())}/{len(results)} catalogue entries")
    if failed:
        say("ERROR", "seed", "failed: " + ", ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:2]))
