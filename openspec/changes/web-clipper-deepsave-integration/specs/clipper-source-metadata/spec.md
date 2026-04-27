## ADDED Requirements

### Requirement: Frontend displays clipper ingest source
DeepSave frontend SHALL display relevant clipper source metadata in the item detail view when such metadata exists.

#### Scenario: Display Hermes source metadata
- **WHEN** an item has `meta_json.ingest.source_app=hermes-web-clipper`
- **THEN** the detail metadata card SHALL show that the item was captured from Hermes web-clipper and include the capture method when available

#### Scenario: Hide absent clipper metadata
- **WHEN** an item has no clipper metadata
- **THEN** the detail metadata card SHALL not show empty or misleading clipper source fields

### Requirement: Frontend exposes related links as references
DeepSave frontend SHALL expose clipper-discovered related links as references without automatically saving them.

#### Scenario: Show related link count
- **WHEN** an item has `meta_json.related_links` entries
- **THEN** the detail view SHALL show the number of discovered related links and provide a way to inspect them

#### Scenario: Related links are not items until saved
- **WHEN** an item contains related link metadata
- **THEN** DeepSave SHALL NOT treat those related links as saved items unless a user or client explicitly ingests them

### Requirement: Frontend summarizes image metadata
DeepSave frontend SHALL display image metadata summaries when clipper-provided image metadata exists.

#### Scenario: Show image metadata count
- **WHEN** an item has `meta_json.images` entries
- **THEN** the detail metadata area SHALL show an image count or image section without requiring each image to have a generated vision description
