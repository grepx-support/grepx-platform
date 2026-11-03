"""grepx_config - where settings come from, in one place (no other GrepX dependency).

    load_config(service_dir / "config")   a service's merged configuration
    workspace_root(), common()            the workspace and its settings (config/common.yaml + the product's deployment file)
    workspace_file(), product_settings()  grepx.workspace.yaml and the product deployment file it names
    nexus_address()                       the Nexus hub
    deployment.site_url() / org_name() / timezone() / link(cfg, page)   deployment values (.env)
"""
from .loader import Config, load_config, merge, nexus_address, resolve_log_dir
from .workspace import common, product_settings, workspace_file, workspace_root

__all__ = ["Config", "common", "load_config", "merge", "nexus_address", "product_settings", "resolve_log_dir", "workspace_file",
           "workspace_root"]
