## ADDED Requirements

### Requirement: Content format is normalized before analysis
DeepSave SHALL normalize externally provided content into the internal HTML representation before worker analysis or frontend editing.

#### Scenario: Markdown content normalization
- **WHEN** provided content is marked as `content_format=markdown`
- **THEN** DeepSave SHALL convert Markdown to HTML, store `content_format=html`, and derive plain text from the HTML for AI processing

#### Scenario: Plain text content normalization
- **WHEN** provided content is marked as `content_format=text`
- **THEN** DeepSave SHALL escape and paragraphize the text into HTML, store `content_format=html`, and derive plain text from the HTML for AI processing

#### Scenario: HTML content normalization
- **WHEN** provided content is marked as `content_format=html`
- **THEN** DeepSave SHALL sanitize or otherwise normalize the HTML before saving it as the item content

### Requirement: Provided content updates item revisions
DeepSave SHALL update content revision state consistently when provided content changes an item.

#### Scenario: New provided content item
- **WHEN** a new item is created with provided content
- **THEN** DeepSave SHALL set `content_revision` and `processing_target_revision` so the queued analysis targets the newly saved content

#### Scenario: Existing item receives new provided content
- **WHEN** an existing item receives new provided content that differs from its current content
- **THEN** DeepSave SHALL increment `content_revision`, set `processing_status=pending`, and queue analysis for the new revision

### Requirement: Provided content remains article content when source type is article
DeepSave SHALL preserve the caller-provided `source_type` when processing provided content.

#### Scenario: Article content remains article
- **WHEN** a client submits `source_type=article` with provided content
- **THEN** the item SHALL remain `source_type=article` throughout ingest, worker processing, list views, detail views, and search results
