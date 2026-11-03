"""grepx_bff — everything a product BFF shares: gateway, auth, errors, tracing, common routers, app factory.

    app = create_app(Gateway(client, cfg), [my_product_router, ...], "My product API", web_dir=..., product="kitchen")
A product BFF only adds routes for its own services.
"""
from .app import create_app
from .errors import ApiError, register_copy
from .views import register_hidden
from .gateway import CURRENT_TRACE, Gateway
from .security import Principal, admin, current_user, gateway, optional_user, require

__all__ = ["create_app", "ApiError", "register_copy", "register_hidden", "CURRENT_TRACE", "Gateway", "Principal", "admin", "current_user", "gateway",
           "optional_user", "require"]
