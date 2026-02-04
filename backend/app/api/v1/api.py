from fastapi import APIRouter
from app.api.v1.endpoints import auth, items

api_router = APIRouter()
api_router.include_router(auth.router, tags=["login"])
api_router.include_router(items.router, prefix="/items", tags=["items"])
# api_router.include_router(users.router, prefix="/users", tags=["users"])
