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
- `openspec/`: OpenSpec project context, active changes, and capability specs.
- `.codex/`: OpenSpec-generated Codex skills for proposal/apply/archive workflows.

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

## Session Summary (Changes / Issues / Notes)
### Key Changes
- Added `content_revision / analysis_revision / processing_target_revision` to the backend to decouple “edit save” and “analysis rerun,” preventing old tasks from overwriting new content.
- Changed the edit save strategy to **manual save**: when there are changes, a “Save” button appears in the top-right of the detail page, and content is written only after clicking it.
- Added `POST /items/{id}/reprocess-content`, which manually triggers analysis rerun (summary + tags + vectors).
- Added “pending recalculation/recalculate analysis” prompts and entry points in frontend list/detail views (based on revision difference checks).
- Integrated the Tiptap Markdown editor, switching to the `tiptap-markdown` extension.
- Refactored the homepage to centered search + dropdown results, added a left icon sidebar and `/timeline` timeline.
- Added overview stats, recent cards, frequently used tags, recent searches, and quick entry points on the homepage; added `GET /items/overview`.
- Redesigned the extension Popup: added icons and style improvements, moved API configuration to the settings page with a gear entry point.
- Replaced the detail editor with `minimal-tiptap` (shadcn) and unified content storage as HTML (`content_format=html`).
- Moved save/reprocess actions into the editor toolbar as icon buttons; “analysis outdated” now uses toast instead of a persistent badge.
- Added metadata card on the detail page; moved type/status/read state/open original/time into it.
- Added editable title on the detail page (auto-resize, blur to save, Esc to cancel).
- Added settings for note area width and editor text size (3 levels each), persisted via localStorage and applied via CSS variables.
- Added mobile layout: sidebar becomes bottom tab navigation; detail page secondary info uses collapsible cards.

### Issues Encountered
- NextAuth may show `[next-auth][error][JWT_SESSION_ERROR]`, usually caused by `NEXTAUTH_SECRET` being changed or inconsistent.
- `npm` installation of `@tiptap/extension-markdown` returns 404 (not on public npm), so `tiptap-markdown` must be used.
- The worker previously hit `Future attached to a different loop`, caused by reusing asyncpg connections across event loops.
- During LAN access, inconsistent CORS / API BASE URL configuration caused frontend request failures or 502/500 errors.
- Auto-save logic caused state confusion and unsaved content; it has been changed to manual save.
- `/items/overview` initially returned 500 (Postgres SRF in WHERE); fixed by expanding tags via subquery and rebuilding the backend image.
- Radix Tooltip requires `TooltipProvider`; missing provider causes runtime error.
- Dropdown triggers can break if toolbar buttons do not forward refs or use non-button nodes.
- Tailwind `text-[var(--x)]` is treated as color; use `text-[length:var(--x)]` for font size.
- Mobile editor overflow requires `min-w-0` on containers and `overflow-wrap:anywhere` on ProseMirror.

### Notes
- Edit save should only increment `content_revision` and should not modify `processing_status`; rerun is triggered by the manual button.
- After migration, run `alembic upgrade head`, then rebuild/restart backend+worker.
- The list “pending recalculation” depends on `content_revision > analysis_revision`, and appears only after a successful save.
- For new APIs or frontend changes, run `docker compose build` + `up -d` to ensure containers load the latest images.
- Communicate with Chinese, Thinking with English.
- Bottom tab navigation should reserve safe-area padding to avoid covering content.
- UI preferences are managed via a top-level provider; avoid per-page local state to prevent resets on navigation.
