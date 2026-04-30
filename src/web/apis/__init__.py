from fastapi import APIRouter

from web.apis import status

api_router = APIRouter()
api_router.include_router(status.router)
