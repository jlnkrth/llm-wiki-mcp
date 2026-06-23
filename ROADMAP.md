# Roadmap

Future work for [LLM Wiki MCP](README.md). Inspired by gaps vs [Karpathy's LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## v0.2 — Local image assets

**Problem:** v0.1 `wiki_read_raw` returns metadata only for binary files (images, PDFs). Karpathy recommends downloading images locally so the LLM can reference them reliably.

**Proposed solution:**

- Document Obsidian workflow in starter `AGENTS.md`:
  - Attachment folder: `raw/assets/`
  - Obsidian Web Clipper for web articles
  - Hotkey: "Download attachments for current file"
- Add `raw/assets/.gitkeep` to starter wiki
- Optional MCP enhancement: `wiki_read_raw_image` returning base64 for images, or extend `wiki_read_raw` with a `include_binary` flag

**Effort:** Small (docs) to medium (binary MCP support)

---

## v0.3 — Rich query outputs

**Problem:** Karpathy notes that good answers can take many forms — comparison tables, Marp slide decks, charts — and should be filed back into the wiki.

**Proposed solution:**

- Add comparison table and synthesis templates to `AGENTS.md`
- Document Marp export workflow from wiki pages
- Optional `wiki_get_log(limit?)` tool for recent history without reading full `log.md`

**Effort:** Small (docs) to medium (log tool)

---

## v0.4 — Search upgrades

**Problem:** MiniSearch (BM25-style) works well at moderate scale. Karpathy mentions [qmd](https://github.com/tobi/qmd) for hybrid BM25 + vector search at larger scale.

**Proposed solution:**

- Evaluate qmd as optional search backend behind `wiki_search`
- Document Dataview-compatible frontmatter conventions for Obsidian power users

**Effort:** Medium to large

---

## v0.5 — Team wikis and domain configs

**Problem:** Private deployments (e.g. agency wikis) need domain-specific page types and bundled reads.

**Proposed solution:**

- Optional `bundles` in `wiki.config.yaml` (e.g. read hub + related pages in one call)
- Human-in-the-loop review workflow docs for team-maintained wikis

**Effort:** Medium

---

## Contributing

This is early-stage. Open an issue on [GitHub](https://github.com/jlnkrth/llm-wiki-mcp/issues) to discuss priorities.
