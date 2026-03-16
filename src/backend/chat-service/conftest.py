"""
Root conftest for chat-service pytest runs inside Docker.

Adds /app/ (backend root) to sys.path so that `from shared.X import Y`
works the same way it does when uvicorn starts from /app/.
"""
import sys
from pathlib import Path

_service_dir = Path(__file__).resolve().parent   # /app/service
_backend_dir = _service_dir.parent               # /app

# /app/ must be on sys.path first so "from service.ws.router import router"
# resolves to the service/ package directory, not service.py.
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))
# /app/service/ on sys.path so bare imports (models, persistence) also work.
if str(_service_dir) not in sys.path:
    sys.path.insert(1, str(_service_dir))
