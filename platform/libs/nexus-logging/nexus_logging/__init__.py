# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Logging setup, standalone - no nexus_api dependency, usable anywhere.

    from nexus_logging import configure_logging, timestamped_log_path
"""
from .log_naming import run_timestamp, timestamped_log_path
from .context import SERVICE, TRACE_ID
from .json_format import JsonFormatter
from .logging_config import configure_logging

__all__ = ["configure_logging", "timestamped_log_path", "run_timestamp", "TRACE_ID", "SERVICE", "JsonFormatter"]
