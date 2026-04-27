## 1. OpenSpec and documentation setup

- [ ] 1.1 Confirm OpenSpec CLI is installed as a dev dependency in the DeepSave root package.
- [ ] 1.2 Confirm OpenSpec project structure exists under `openspec/` and Codex helper files exist under `.codex/`.
- [ ] 1.3 Validate the `web-clipper-deepsave-integration` change with `npx openspec validate web-clipper-deepsave-integration --strict`.

## 2. DeepSave ingest API schema

- [ ] 2.1 Extend `backend/app/schemas/items.py::IngestRequest` with `content_format`, `meta_json`, `skip_fetch`, and `source_app`.
- [ ] 2.2 Extend `backend/app/schemas/items.py::IngestResponse` with optional `status` and `detail_url`.
- [ ] 2.3 Update `backend/app/api/items.py` to pass the new request fields into `IngestService.ingest()`.
- [ ] 2.4 Add or update backend tests for URL-only ingest response shape.
- [ ] 2.5 Add or update backend tests proving `content_text` without `source_type=note` does not automatically become note.

## 3. Ingest service semantics

- [ ] 3.1 Refactor `backend/app/services/ingest_service.py` so `content_text` does not imply `source_type=note`.
- [ ] 3.2 Require non-empty content only when `resolved_source_type == "note"`.
- [ ] 3.3 Normalize provided content according to `content_format` before upsert.
- [ ] 3.4 Store `source_app`, `skip_fetch`, capture method, and client metadata under `meta_json.ingest`.
- [ ] 3.5 Preserve URL-only ingest behavior for ordinary article/image/video URLs.

## 4. Repository and metadata persistence

- [ ] 4.1 Extend `backend/app/repositories/item_repo.py::ItemRepository.upsert()` to accept `meta_json`.
- [ ] 4.2 Persist `meta_json` for new items.
- [ ] 4.3 Merge `meta_json` for existing items without discarding unrelated existing fields.
- [ ] 4.4 Ensure provided content updates `content_revision`, `content_format`, `processing_target_revision`, and `processing_status` consistently.

## 5. Provided-content worker path

- [ ] 5.1 Add a helper that detects whether an item should skip fetch based on `meta_json.ingest.skip_fetch` and existing content.
- [ ] 5.2 Refactor `backend/app/worker/tasks.py` article branch so provided-content items skip scraper execution.
- [ ] 5.3 Reuse the existing polish, summarize, tag, chunk, embed, and `_save_results()` flow for provided content.
- [ ] 5.4 Add tests or a worker-level verification script for `article + content_text + skip_fetch`.

## 6. Frontend metadata display

- [ ] 6.1 Locate the item detail metadata card in the Next.js frontend.
- [ ] 6.2 Display clipper source app and capture method when `meta_json.ingest` exists.
- [ ] 6.3 Display related links count and provide an inspectable list or collapsed section.
- [ ] 6.4 Display image metadata count when `meta_json.images` exists.
- [ ] 6.5 Verify empty metadata does not render placeholder noise.

## 7. Hermes web-clipper skill changes

- [ ] 7.1 Update the `web-clipper` skill to read DeepSave API base URL and token from configuration or environment.
- [ ] 7.2 Add a DeepSave health/auth check before clipping.
- [ ] 7.3 Change the default save path to `POST /items/ingest` URL-only for ordinary pages.
- [ ] 7.4 Add provided-content mode for pages already extracted by Hermes browser tools.
- [ ] 7.5 Keep Markdown `collections/` save as fallback when DeepSave is unavailable or explicitly requested.
- [ ] 7.6 Change related links behavior so discovered links are metadata by default, not recursively saved.
- [ ] 7.7 Update final user feedback to include DeepSave `item_id`, `task_id`, `reused`, status, and detail URL when available.

## 8. Verification and rollout

- [ ] 8.1 Run backend focused tests for ingest service and repository behavior.
- [ ] 8.2 Run worker verification for URL-only article, provided-content article, explicit note, and image URL.
- [ ] 8.3 Run frontend lint/build after metadata card changes.
- [ ] 8.4 Manually clip one ordinary article through web-clipper and confirm it appears in DeepSave.
- [ ] 8.5 Manually clip one browser-extracted article with `skip_fetch=true` and confirm worker does not fetch the URL.
- [ ] 8.6 Manually simulate DeepSave unavailable and confirm web-clipper falls back to `collections/`.
- [ ] 8.7 Document environment variables and operational notes in DeepSave docs or the web-clipper skill.
