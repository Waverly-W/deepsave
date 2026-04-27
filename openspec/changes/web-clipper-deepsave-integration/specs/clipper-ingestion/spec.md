## ADDED Requirements

### Requirement: DeepSave accepts URL-only clipper ingest
DeepSave SHALL allow external clipper clients to submit a URL with an optional `source_type` and enqueue the item for normal backend fetching and AI processing.

#### Scenario: Save ordinary article URL
- **WHEN** a clipper client submits `POST /items/ingest` with a valid article URL and no provided content
- **THEN** DeepSave SHALL upsert the item by normalized URL, enqueue a processing task, and return `item_id`, `task_id`, and `reused=false`

#### Scenario: Reuse active ingest for duplicate URL
- **WHEN** a clipper client submits a URL that is already locked or currently processing
- **THEN** DeepSave SHALL return the existing `item_id` and `task_id` with `reused=true` instead of creating duplicate work

#### Scenario: Reject unsafe URL
- **WHEN** a clipper client submits an unsafe, invalid, or blocked URL
- **THEN** DeepSave SHALL reject the request before queueing any worker task

### Requirement: DeepSave accepts provided article content
DeepSave SHALL allow external clipper clients to submit already-extracted article content without forcing the item to become a note.

#### Scenario: Save provided article markdown
- **WHEN** a clipper client submits `source_type=article`, `content_text`, `content_format=markdown`, and `skip_fetch=true`
- **THEN** DeepSave SHALL store the item as an article, normalize the content to HTML, mark it for processing, and enqueue AI analysis without requiring another fetch

#### Scenario: Save provided article HTML
- **WHEN** a clipper client submits `source_type=article`, `content_text`, `content_format=html`, and `skip_fetch=true`
- **THEN** DeepSave SHALL sanitize or normalize the HTML, store it with `content_format=html`, and process it as article content

#### Scenario: Missing source type does not imply note for article URL
- **WHEN** a clipper client submits a URL with `content_text` but without `source_type`
- **THEN** DeepSave SHALL route the URL normally and SHALL NOT automatically classify the item as `note` solely because content was provided

### Requirement: Notes require explicit note intent
DeepSave SHALL create note items only when the caller explicitly expresses note intent.

#### Scenario: Explicit note ingest
- **WHEN** a client submits `source_type=note` with non-empty `content_text`
- **THEN** DeepSave SHALL create or update a note item, normalize the note content to HTML, and enqueue note processing

#### Scenario: Empty note rejected
- **WHEN** a client submits `source_type=note` with empty or whitespace-only content
- **THEN** DeepSave SHALL reject the request with a validation error and SHALL NOT enqueue a processing task

### Requirement: DeepSave stores clipper source metadata
DeepSave SHALL persist structured metadata about the external clipper source, capture method, source page metadata, images, and related links in `items.meta_json`.

#### Scenario: Store Hermes clipper metadata
- **WHEN** a clipper client submits metadata containing `source_app=hermes-web-clipper`, capture method, image list, or related links
- **THEN** DeepSave SHALL persist those values under stable `meta_json` namespaces without discarding existing unrelated metadata

#### Scenario: Merge metadata on duplicate item
- **WHEN** a clipper client submits new metadata for an item that already exists
- **THEN** DeepSave SHALL merge the new metadata with existing `meta_json` where possible instead of blindly replacing the entire metadata document

### Requirement: Worker supports provided-content processing
DeepSave worker SHALL process provided article content without fetching the URL when the item explicitly requests skip-fetch behavior.

#### Scenario: Skip fetch for provided article
- **WHEN** an article item has non-empty normalized content and `meta_json.ingest.skip_fetch=true`
- **THEN** the worker SHALL skip scraper execution and run language detection, polish, summarization, tag extraction, chunking, embedding, and result persistence against the provided content

#### Scenario: Fall back to fetch when skip_fetch absent
- **WHEN** an article item has a URL but no explicit skip-fetch metadata
- **THEN** the worker SHALL use the existing scraper pipeline before AI processing

### Requirement: Ingest response is clipper-friendly
DeepSave SHALL return enough information for external clipper clients to show useful user feedback after saving.

#### Scenario: Return task and item identifiers
- **WHEN** an ingest request succeeds
- **THEN** the response SHALL include `item_id`, `task_id` when a task is queued, and `reused`

#### Scenario: Return optional detail URL and status
- **WHEN** DeepSave can determine the frontend detail URL or processing status
- **THEN** the response SHALL include `detail_url` and `status` fields for clipper clients to display

### Requirement: Web-clipper saves to DeepSave first
Hermes `web-clipper` SHALL use DeepSave as the primary save target when DeepSave configuration is available.

#### Scenario: DeepSave available
- **WHEN** a user asks Hermes to clip a URL and DeepSave health/auth checks pass
- **THEN** `web-clipper` SHALL submit the URL or extracted payload to DeepSave and report the returned item/task information to the user

#### Scenario: DeepSave unavailable
- **WHEN** DeepSave health/auth checks fail or the API request cannot complete
- **THEN** `web-clipper` SHALL fall back to saving a Markdown backup under `collections/` and clearly tell the user that DeepSave was unavailable

### Requirement: Related links are not recursively saved by default
Hermes `web-clipper` SHALL avoid automatically saving discovered related links unless the user explicitly requests recursive or batch save behavior.

#### Scenario: Record related links only
- **WHEN** `web-clipper` discovers related links during clipping and the user did not request recursive save
- **THEN** it SHALL submit or store those links as metadata only and SHALL NOT enqueue separate DeepSave items for them

#### Scenario: Explicit recursive save
- **WHEN** the user explicitly asks to save related links as well
- **THEN** `web-clipper` MAY submit each selected related URL to DeepSave as separate ingest requests and SHALL report the batch result
