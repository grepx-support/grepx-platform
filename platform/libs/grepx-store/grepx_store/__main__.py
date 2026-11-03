"""python -m grepx_store <service-folder> - create that service's database and tables."""
import sys
from pathlib import Path

from .setup import setup_service

setup_service(Path(sys.argv[1] if len(sys.argv) > 1 else "."))
