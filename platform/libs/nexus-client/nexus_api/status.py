# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Row/transaction status values used across every Nexus consumer -
shared here so services compare against RowStatus.NEW instead of the
string "NEW".
"""
from enum import Enum


class RowStatus(str, Enum):
    NEW = "NEW"
    REQUESTED = "REQUESTED"
    CLAIMED = "CLAIMED"
    ACCEPTED = "ACCEPTED"
    AUTHENTICATED = "AUTHENTICATED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"
