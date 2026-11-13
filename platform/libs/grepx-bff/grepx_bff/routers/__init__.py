# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Routers every product BFF gets for free (mounted by grepx_bff.create_app)."""
from . import access, auth, gateway_commands, integrations, media, messages, photo, profile, tasks

COMMON_ROUTERS = [auth.router, profile.router, photo.router, tasks.router, messages.router, integrations.router, access.router, media.router, gateway_commands.router]
