"""grepx_common - value objects every product shares, configured per deployment (no product words in code).

    Phone      home-country phone numbers (deployment settings phone:)
    Roles      the role ladder (deployment settings roles:)
"""
from .phone import Phone, PhoneError, PhoneRules
from .roles import Roles

__all__ = ["Phone", "PhoneError", "PhoneRules", "Roles"]
