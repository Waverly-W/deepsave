# Backend Structure (BACKEND_STRUCTURE.md)

> This document defines the folder structure for the Backend (FastAPI).

## Directory Tree

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Entry point
│   ├── api/                 # API Routes
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py
│   │   │   │   ├── items.py
│   │   │   │   └── system.py
│   │   │   └── api.py       # Router Aggregator
│   │   └── deps.py          # Dependencies (DB session, Current User)
│   ├── core/                # Core Config
│   │   ├── config.py        # Pydantic Settings
│   │   ├── security.py      # JWT & Password Config
│   │   └── events.py        # Startup/Shutdown events
│   ├── db/                  # Database
│   │   ├── base.py
│   │   ├── session.py
│   │   └── init_db.py
│   ├── models/              # SQLAlchemy Models
│   │   ├── item.py
│   │   ├── user.py
│   │   └── tag.py
│   ├── schemas/             # Pydantic Schemas (DTOs)
│   │   ├── item.py
│   │   ├── token.py
│   │   └── user.py
│   ├── services/            # Business Logic
│   │   ├── ingestion/       # Scraper Modules
│   │   │   ├── http_client.py
│   │   │   └── browser.py
│   │   └── inference/       # LLM Clients
│   │       ├── local_client.py
│   │       └── router.py
│   └── worker/              # Celery Tasks
│       ├── celery_app.py
│       └── tasks.py
├── alembic/                 # Migrations
├── tests/
├── .env
├── .gitignore
├── docker-compose.yml       # Dev Compose
├── requirements.txt
└── Dockerfile
```

## Key Module Responsibilities

1.  **`app/services/ingestion`**: Handles all "dirty" work of fetching URLs. Must abstract away the difference between `trafilatura` and `playwright`.
2.  **`app/services/inference`**: The client that talks to Ollama (Remote) or DeepSeek (Cloud). It implements the "Tiny Model Classification" logic.
3.  **`app/worker/tasks.py`**: The only entry point for long-running jobs. API endpoints should ONLY push tasks here, never run scraping inline.
