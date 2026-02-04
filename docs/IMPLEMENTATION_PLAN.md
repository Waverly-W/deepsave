# Implementation Plan (IMPLEMENTATION_PLAN.md)

> This document tracks the step-by-step build process.

## Phase 1: Foundation (The Skeleton)

### 1.1 Infrastructure Setup
- [x] **Docker Environment**: Create `docker-compose.yml` with Postgres, Redis, ChromaDB.
- [x] **Repository Init**: Set up Monorepo structure (`frontend`, `backend`, `extension`).

### 1.2 Backend Core
- [x] **FastAPI Setup**: Init project with defined structure.
- [x] **Database Helpers**: Setup SQLAlchemy Async Engine & Alembic.
- [x] **Auth Module**: Implement `User` model, Login endpoint, JWT generation, and 2FA (TOTP) Logic.
- [x] **CRUD API**: Create basic `Item` create/read/delete endpoints.

### 1.3 Frontend Bootstrap
- [x] **Next.js Init**: `create-next-app` with TypeScript, Tailwind.
- [x] **Components**: Install `shadcn/ui` core (Button, Input, Form, Card, Sheet, Dropdown).
- [x] **Auth Pages**: Build Login Screen & 2FA Setup Screen.
- [x] **Dashboard Shell**: Create standard App Layout (Sidebar + Main Content Area).

## Phase 2: Ingestion & Processing (The Brain)

### 2.1 Chrome Extension (MVP)
- [x] **Extension Init**: Vite + React build setup.
- [x] **Auth Logic**: Login to Backend from Extension.
- [x] **Capture Logic**: Get active tab URL & HTML, send to `/api/v1/ingest`.

### 2.2 Scraper Worker
- [x] **Celery Setup**: Connect Worker to Redis.
- [x] **Scraper Logic**: Implement `trafilatura` fetcher.
- [ ] **Fallback Logic**: Implement `playwright` fetcher (Headless).
- [x] **Storage**: Save raw HTML/One-file to NAS volume.

### 2.3 AI Pipeline
- [x] **Classification**: Implement rule/tiny-model based classifier.
- [ ] **LLM Client**: Implement `InferenceClient` that can switch between `DeepSeek-API` and `Remote-Ollama-URL`.
- [ ] **Prompt Engineering**: Write system prompts for `Summarizer`, `Tagger`.

## Phase 3: Search & Retrival (The Output)

### 3.1 Vector Search
- [x] **Embedding**: Chunk content and generate embeddings.
- [x] **ChromaDB**: Store vectors.
- [ ] **Search API**: Implement hybrid search endpoint.

### 3.2 UI Polish
- [x] **Gallery View**: Masonry layout for items.
- [ ] **Reading Mode**: Distraction-free reader + AI Sidebar.

## Phase 4: Hardening
- [ ] **Security Review**: Check Token expiration, Rate limits.
- [ ] **Garbage Collection**: Implement "Empty Trash" background job.
- [ ] **Documentation**: Write deployment guide for User.
