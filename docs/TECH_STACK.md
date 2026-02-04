# Technology Stack (TECH_STACK.md)

> **Strict Enforcement:** No libraries outside this list may be introduced without an update to this document.

## 1. Frontend (The Interface)
*   **Framework**: Next.js 14+ (App Router)
*   **Language**: TypeScript 5.x
*   **Styling**: Tailwind CSS 3.x
*   **UI Components**: shadcn/ui (Radix UI based)
*   **Icons**: Lucide React
*   **State Management**: Zustand (for global store), TanStack Query (React Query) v5 (for API state)
*   **Form Handling**: React Hook Form + Zod (Validation)
*   **Markdown Rendering**: `react-markdown` + `rehype-highlight`

## 2. Backend (The Core)
*   **Language**: Python 3.11+
*   **Web Framework**: FastAPI (Async)
*   **Task Queue**: Celery 5.x
*   **Message Broker**: Redis 7.x (Alpine)
*   **Database ORM**: SQLAlchemy 2.0+ (Async)
*   **Migrations**: Alembic
*   **Authentication**:
    *   `python-jose` (JWT handling)
    *   `passlib` (bcrypt hashing)
    *   `pyotp` (2FA/TOTP generation & verification)

## 3. Data Persistence (The Memory)
*   **Relational DB**: PostgreSQL 15 (Alpine)
    *   Run on NAS via Docker.
*   **Vector DB**: ChromaDB (Running in Client/Server mode on NAS)
    *   Using Docker container: `chromadb/chroma`
*   **File Storage**: Local NAS Filesystem (Mapped Volume)

## 4. AI & Scraping (The Agents)
*   **Scraping**:
    *   `trafilatura` (Primary, text extraction)
    *   `playwright` (Secondary, DOM Snapshot)
    *   `beautifulsoup4` (Parsing)
*   **LLM Interface**: `openai` (Python SDK - compatible with Ollama & DeepSeek)
*   **Embedding**: `sentence-transformers` (Local CPU) or API-based.

## 5. DevOps & Infrastructure
*   **Runtime**: Docker Engine + Docker Compose
*   **Reverse Proxy**: Nginx (Optional, handling SSL termination if not using Cloudflare)
*   **CI/CD**: Local Git Hooks (Pre-commit: Black, Flake8, ESLint)

## 6. Browser Extension
*   **Manifest**: V3
*   **Framework**: React + Vite (Build to static assets)
