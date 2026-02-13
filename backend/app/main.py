import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.items import router as items_router
from app.api.search import router as search_router
from app.api.system import router as system_router
from app.api.tags import router as tags_router


def create_app() -> FastAPI:
    app = FastAPI(title="DeepSave Pro API")
    origins = os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://127.0.0.1:3000,http://localhost:3000",
    ).split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in origins if origin.strip()],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(system_router)
    app.include_router(items_router)
    app.include_router(search_router)
    app.include_router(tags_router)
    return app


app = create_app()
