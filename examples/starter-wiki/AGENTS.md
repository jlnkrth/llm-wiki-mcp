# LLM Wiki — Schema & Conventions

This file tells the LLM how to maintain this wiki. It follows the [LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) by Andrej Karpathy: a persistent, compounding knowledge base — not per-query RAG.

## Interface — read this first

> **All reads and writes happen through the `llm-wiki` MCP server.**
> Never edit wiki files directly in the filesystem. Use the MCP tools.

| Tool | When to use |
|---|---|
| `wiki_get_index()` | Read the master index — start here when navigating |
| `wiki_list_pages(type?)` | Discover available page slugs |
| `wiki_get_page(type, slug)` | Read one specific page |
| `wiki_search(q, type?, limit?)` | Find pages by content |
| `wiki_list_raw(prefix?, limit?)` | List immutable source files in `raw/` |
| `wiki_read_raw(path)` | Read a raw source file (read-only) |
| `wiki_put_page(...)` | Create or update a page; optionally update `log.md` and `index.md` |

`wiki_put_page` writes the file, optionally updates `log.md` and `index.md`, then commits to git when enabled — all in one atomic operation.

## Architecture

```
my-wiki/
├── AGENTS.md          # This file — conventions and workflows
├── wiki.config.yaml   # Page types and git settings
├── index.md           # Master index (maintained via indexEntry)
├── log.md             # Chronological log (maintained via logEntry)
├── raw/               # Raw sources (IMMUTABLE — never modify via MCP)
└── wiki/              # LLM-maintained pages
    ├── entities/      # People, orgs, projects
    ├── concepts/      # Ideas, themes
    ├── sources/       # Summaries of raw/ drops
    ├── synthesis/     # Evolving thesis / overview
    └── topics/        # Cross-cutting pages
```

## Rules

1. **Never edit files directly.** `wiki_put_page` is the only write path.
2. **Never modify `raw/`.** Raw sources are immutable reference material.
3. **Every wiki page must have YAML frontmatter** with at minimum `type` and `slug`.
4. **Use `[[wikilinks]]` for cross-references** between wiki pages.
5. **Update `index.md` after every new page** via `indexEntry` on `wiki_put_page`.
6. **Append to `log.md` after substantive changes** via `logEntry`.
7. **Slug format**: kebab-case, matching `/^[a-z0-9][a-z0-9_-]*$/i`.

## Page types

| MCP `type` | Purpose | Frontmatter `type` |
|---|---|---|
| `entities` | People, organizations, projects | `entity` |
| `concepts` | Ideas, themes, definitions | `concept` |
| `sources` | Summaries of ingested raw material | `source` |
| `synthesis` | Evolving overview / thesis pages | `synthesis` |
| `topics` | Cross-cutting subject pages | `topic` |

## Workflows

### Ingest

When the user drops a new source into `raw/`:

1. `wiki_list_raw()` to discover the file, then `wiki_read_raw(path)` to read it.
2. Discuss key takeaways with the user if appropriate.
3. `wiki_put_page` a source summary in `sources/`.
4. Update relevant entity and concept pages (read → merge → write).
5. Pass `indexEntry` for every new page; pass `logEntry` once per ingest.
6. Note contradictions with existing pages explicitly.

### Query

When the user asks a question:

1. `wiki_get_index()` or `wiki_search(q)` to find relevant pages.
2. `wiki_get_page` for the pages you need.
3. Synthesize an answer with citations to wiki pages.
4. If the answer is valuable long-term, file it back via `wiki_put_page` (e.g. under `synthesis/` or `topics/`).

### Lint

Periodically (or when asked):

1. Search for orphan pages (no inbound `[[wikilinks]]`).
2. Find contradictions between pages.
3. Flag stale claims superseded by newer sources.
4. Check index drift (pages exist but aren't in `index.md`).
5. Report findings and fix via `wiki_put_page` with `logEntry: { operation: "lint", ... }`.

## Page templates

### Entity — `type="entities"`

Frontmatter: `{ "type": "entity", "slug": "...", "name": "...", "tags": [] }`

Body sections: Summary, Key facts, Related (`[[wikilinks]]`), Sources.

### Concept — `type="concepts"`

Frontmatter: `{ "type": "concept", "slug": "...", "name": "..." }`

Body sections: Definition, Details, Related concepts, Sources.

### Source — `type="sources"`

Frontmatter: `{ "type": "source", "slug": "...", "title": "...", "date": "YYYY-MM-DD" }`

Body sections: Summary, Key takeaways, Entities/concepts touched, Raw reference path.

### Synthesis — `type="synthesis"`

Frontmatter: `{ "type": "synthesis", "slug": "...", "title": "..." }`

Body sections: Current thesis, Supporting evidence, Open questions, Related pages.

## index.md conventions

Pass `indexEntry` when creating pages:

```json
{
  "section": "Concepts",
  "line": "- [[my-concept]] — One-line summary."
}
```

## log.md conventions

Pass `logEntry` for substantive changes:

```json
{
  "operation": "ingest",
  "description": "Article Title",
  "detail": "Optional longer note."
}
```

Format written: `## [YYYY-MM-DD] <operation> | <description>`
