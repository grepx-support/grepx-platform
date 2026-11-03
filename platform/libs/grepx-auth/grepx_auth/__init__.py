# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""grepx_auth — token, password and secret-transport primitives shared by auth-service and every BFF.

    tokens = TokenService.from_env()          # JWT (HS256) strategy, secret JWT_SECRET
    claims = tokens.verify(token)             # raises InvalidToken
    box = SecretBox.from_env()                # passwords travel encrypted inside Nexus rows
    open_settings(rows)                       # admin-saved settings ("enc:" values opened)
"""
from .passwords import hash_password, verify_password
from .sealed import is_sealed, open_settings, open_value, seal_value
from .secret_box import SecretBox
from .tokens import InvalidToken, JwtStrategy, TokenService, TokenStrategy

__all__ = ["hash_password", "verify_password", "SecretBox", "is_sealed", "open_settings", "open_value", "seal_value", "InvalidToken", "JwtStrategy", "TokenService", "TokenStrategy"]
