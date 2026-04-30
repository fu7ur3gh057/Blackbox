"""Top-level API router. Public endpoints (auth, status) live on the bare
router; everything else is gated behind `require_auth` via a sub-router.
"""

from fastapi import APIRouter, Depends

from web.apis.alerts.routes import router as alerts_router
from web.apis.auth.routes import router as auth_router
from web.apis.checks.routes import router as checks_router
from web.apis.config.routes import router as config_router
from web.apis.deps import require_auth
from web.apis.docker.routes import router as docker_router
from web.apis.logs.routes import router as logs_router
from web.apis.notifiers.routes import router as notifiers_router
from web.apis.reports.routes import router as reports_router
from web.apis.status.routes import router as status_router
from web.apis.system.routes import router as system_router

api_router: APIRouter = APIRouter()

# Public — no auth needed
api_router.include_router(status_router)               # /status (static)
api_router.include_router(auth_router, prefix="/auth")  # login/logout (me requires auth itself)

# Protected — every nested route gets require_auth before reaching the handler
protected = APIRouter(dependencies=[Depends(require_auth)])
protected.include_router(system_router, prefix="/system")
protected.include_router(checks_router, prefix="/checks")
protected.include_router(alerts_router, prefix="/alerts")
protected.include_router(reports_router, prefix="/reports")
protected.include_router(docker_router, prefix="/docker")
protected.include_router(logs_router, prefix="/logs")
protected.include_router(notifiers_router, prefix="/notifiers")
protected.include_router(config_router, prefix="/config")

api_router.include_router(protected)
