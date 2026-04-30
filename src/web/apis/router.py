"""Главный API-роутер. Сюда подключаем sub-роутеры из соседних модулей.

Применяется в web.application через `from web.apis import api_router`,
монтируется под префиксом `/api`.
"""

from fastapi import APIRouter

from web.apis import status
from web.apis.reports.routes import router as reports_router

api_router: APIRouter = APIRouter()

api_router.include_router(status.router)
api_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
