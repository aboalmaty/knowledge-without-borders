# Architecture — Foundation Release

## Principles

- Local-first: SQLite is the source of truth for the desktop application.
- Multilingual UI: locale resources are separated from stored research content.
- Original-preserving translations: each translation is a version linked to a stable benefit ID; it never replaces the source text.
- Portable exchange: `.kwb` bundles contain a versioned data contract, original benefit IDs, category structure, provenance fields and translation records.
- Replaceable integrations: translation and future synchronization services must be adapters, not dependencies of the local core.

## Runtime

- Tauri 2: native desktop shell and Rust command boundary.
- React + Vite: presentation layer.
- SQLite via rusqlite: local persistent store.
- DOMPurify: sanitization before rendering saved rich text.

## Core entities

### Category

`id`, `parent_id`, `name`, `description`, `created_at`.

Categories are hierarchical. Their IDs remain stable when exported and imported. The receiver's importer attempts to match an existing category by exact name and parent when the source ID is not already present.

### Benefit

`id`, `category_id`, `title`, `content_html`, `content_text`, `search_text`, `author`, `book`, `volume`, `page`, `source_language`, `owner_name`, `sender_name`, `imported_at`, `created_at`, `added_at`, `updated_at`.

- `created_at` preserves the origin date when importing.
- `added_at` tracks when the record entered the current library and drives dashboard activity counts.
- `owner_name` identifies the original contributor when known.
- `sender_name` identifies the person who sent the imported bundle when the receiver chooses to record it.

### Translation

`id`, `benefit_id`, `language_code`, `title`, `content_html`, `content_text`, `status`, `translator`, `translated_at`.

There is at most one current translation record per benefit/language in this first release. A future revision-history model can preserve prior translation edits.

## KWB exchange contract

Top-level fields:

- `format`: `KWB`
- `version`: `1`
- `application`
- `exported_at`
- `categories[]`
- `benefits[]` with embedded `translations[]`

Import behavior in 0.1:

- Unknown categories are created, preserving source IDs unless a same-name/same-parent category can be reused.
- Parent-child links are resolved even if nested category records arrive out of order.
- A benefit with an already-present stable ID is skipped rather than overwritten.
- Imported benefits record `imported_at` and `added_at` locally; original `created_at` and owner provenance are preserved.
- Imported translations remain attached to their original benefit ID.

## Search

The initial search layer stores normalized searchable text across title, extracted content, author, book and owner name. Arabic normalization removes common diacritics and tatweel and folds common alef/hamza and ya/waw variants. This is a first lexical layer, not a semantic search engine.

## Future adapter seams

- `TranslationProvider`: automatic translation service adapters (cloud or local model).
- `SemanticSearchProvider`: multilingual embeddings and semantic retrieval.
- `SyncProvider`: opt-in synchronization between devices.
- `AttachmentStore`: managed local attachments plus bundle inclusion and integrity checks.
