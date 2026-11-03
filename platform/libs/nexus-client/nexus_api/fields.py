"""Well-known keys inside a Nexus row's `fields` dict - shared so services
read row.fields.get(RowField.STATUS) instead of the quoted "status".
"""
from enum import Enum


class RowField(str, Enum):
    STATUS = "status"
    ACTION = "action"
    USERNAME = "username"
    PASSWORD = "password"
    FROM_SERVICE = "from_service"
    TO_SERVICE = "to_service"
