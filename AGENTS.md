# Repository Guidelines

## Project Structure & Module Organization
This repository contains product documentation and implementation code. All working documents live under `docs/`.
Document new top-level directories here.

Current top-level directories:
- `backend/`: FastAPI service and supporting modules (app/, worker/, scraper/, ai/, search/).
- `frontend/`: Next.js App Router frontend (app/, Tailwind config, package.json).
- `config/`: Runtime configuration files (router rules, etc.).
- `db/`: Postgres init scripts.
- `extension/`: Chrome extension (Manifest V3) for quick saves and context menu notes.

## Documentation Index
- `docs/QA.md` / `docs/QA2.md` / `docs/QA3.md` / `docs/QA4.md`: locked decision records (highest priority).
- `docs/PRD.md`: current product requirements, MVP scope, and KPIs.
- `docs/APP_FLOW.md`: end-to-end user and system flows.
- `docs/TECH_STACK.md`: authoritative tech stack (strictly enforced).
- `docs/FRONTEND_GUIDELINES.md`: UI rules, routing, states, and interaction standards.
- `docs/BACKEND_STRUCTURE.md`: backend modules, tables, and processing pipeline.
- `docs/IMPLEMENTATION_PLAN.md`: step-by-step execution plan.
- `docs/DEPLOYMENT.md`: deployment, environment variables, and troubleshooting guide.
- `docs/CLAUDE.md`: operating manual and change rules.
- `docs/progress.txt`: granular task checklist with per-step tests.
- `docs/DeepSave_Pro_PRD.md`: extended/legacy PRD reference.
- `docs/DeepSave_Pro_Tech_Architecture.md`: detailed architecture and data flow reference.
- `docs/DeepSave_Pro_UX_Stories.md`: UX vision and user stories.

## Architecture Overview
DeepSave Pro is designed as a local-first, NAS-friendly system: a Next.js frontend calls a FastAPI backend, which dispatches long-running ingestion and AI tasks to a Celery worker via Redis. Metadata, vector search, and text search live in PostgreSQL (pgvector + pg_trgm), and raw artifacts are stored on the NAS filesystem. See `docs/DeepSave_Pro_Tech_Architecture.md` for the detailed pipeline.

## Build, Test, and Development Commands
Frontend (run from `frontend/`):
- `npm install`: install Node dependencies.
- `npm run dev`: start the Next.js dev server on port 3000.
- `npm run build`: create a production build.
- `npm run start`: run the production server on port 3000.
- `npm run lint`: run Next.js linting.

Docker Compose (run from repo root):
- `docker compose --profile cpu up`: start core services (frontend, backend, worker, db, redis).
- `docker compose --profile gpu up`: start core services plus Ollama.

## Coding Style & Naming Conventions
- Markdown: use ATX headings (`#`, `##`), fenced code blocks with language tags, and 2-space indentation for nested lists.
- Filenames: follow existing patterns like `DeepSave_Pro_*.md` and uppercase constants like `TECH_STACK.md`.
- Planned formatting/linting: `Black`, `Flake8`, and `ESLint` are the expected tools per `docs/TECH_STACK.md`; add configuration files when code lands.

## Testing Guidelines
No test framework or coverage targets are defined yet. When tests are added, document the chosen framework per layer, the directory layout (for example `tests/` or co-located), coverage expectations, and the commands to run full and focused test suites.

## Commit & Pull Request Guidelines
Commit history shows short, sentence-case subjects (e.g., `Initial commit: DeepSave Pro foundation`). Keep commits concise and descriptive; use a brief subject and optional detail after a colon.
PRs should summarize the documentation changes, list any related issues or decisions, and update all affected docs (PRD, UX stories, architecture, or tech stack) for consistency.

## 本次会话总结（变更 / 问题 / 注意事项）
### 关键变更
- 后端新增 `content_revision / analysis_revision / processing_target_revision`，用于解耦“编辑保存”与“分析重跑”，避免旧任务覆盖新内容。
- 编辑保存策略改为**手动保存**：有改动即在详情页右上角显示“保存”按钮，点击后才写入内容。
- 新增 `POST /items/{id}/reprocess-content`，由手动触发分析重跑（摘要+标签+向量）。
- 前端列表/详情增加“待重算/重算分析”提示与入口（依赖 revision 差值判断）。
- Tiptap Markdown 编辑器接入，改用 `tiptap-markdown` 扩展。

### 已遇到问题
- NextAuth 可能出现 `[next-auth][error][JWT_SESSION_ERROR]`，通常是 `NEXTAUTH_SECRET` 变更或不一致导致。
- npm 安装 `@tiptap/extension-markdown` 404（不在公开 npm），需改用 `tiptap-markdown`。
- worker 曾出现 `Future attached to a different loop`，原因是跨事件循环复用 asyncpg 连接。
- 局域网访问时 CORS / API BASE URL 配置不一致导致前端请求失败或 502/500。
- 自动保存逻辑导致状态混乱与内容未保存，已改为手动保存。

### 注意事项
- 编辑保存只提升 `content_revision`，不应改动 `processing_status`；重跑由手动按钮触发。
- 迁移后需运行 `alembic upgrade head`，并重建/重启 backend+worker。
- 列表“待重算”依赖 `content_revision > analysis_revision`，保存成功后才会出现。
