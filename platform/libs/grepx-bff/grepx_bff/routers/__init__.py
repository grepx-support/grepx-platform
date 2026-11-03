"""Routers every product BFF gets for free (mounted by grepx_bff.create_app)."""
from . import access, auth, gateway_commands, media, messages, profile, tasks

COMMON_ROUTERS = [auth.router, profile.router, tasks.router, messages.router, access.router, media.router, gateway_commands.router]
