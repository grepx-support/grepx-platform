# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""grepx_testkit - test one service (ServiceHarness) or the whole stack (start_stack) on an in-memory Nexus."""
from .harness import ServiceHarness

__all__ = ["ServiceHarness"]
