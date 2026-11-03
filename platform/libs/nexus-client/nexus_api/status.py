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
