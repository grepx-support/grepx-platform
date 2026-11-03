# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""grepx_common - value objects every product shares, configured per deployment (no product words in code).

    Phone      home-country phone numbers (deployment settings phone:)
    Roles      the role ladder (deployment settings roles:)
"""
from .phone import Phone, PhoneError, PhoneRules
from .roles import Roles

__all__ = ["Phone", "PhoneError", "PhoneRules", "Roles"]
