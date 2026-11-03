# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""scripts/run.sh trace TRACE_ID - follow one request through every service."""
import sys

from grepx_service.tracing import explain, render
from nexus_api import NexusClient

if __name__ == "__main__":
    client = NexusClient("trace-cli")
    print(render(explain(sys.argv[1], client.trace(sys.argv[1]))))
