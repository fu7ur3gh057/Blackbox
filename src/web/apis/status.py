from fastapi import APIRouter

router = APIRouter(tags=["status"])


@router.get("/status")
async def get_status() -> dict:
    return {
        "service": "blackbox",
        "version": "0.1.0",
    }
