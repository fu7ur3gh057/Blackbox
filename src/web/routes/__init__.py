from fastapi import APIRouter

from web.routes import status

api_router = APIRouter()
api_router.include_router(status.router)
