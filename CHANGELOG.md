# Changelog

## 0.1.0 — 2026-06-23

First public release.

### Features

- MCP server for LLM-maintained markdown wikis ([Karpathy LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f))
- Seven MCP tools: `wiki_get_index`, `wiki_list_pages`, `wiki_get_page`, `wiki_search`, `wiki_list_raw`, `wiki_read_raw`, `wiki_put_page`
- Local stdio transport via `npx @jlnkrth/llm-wiki-mcp`
- Optional HTTP + Docker deployment for team wikis
- Configurable page types via `wiki.config.yaml`
- MiniSearch full-text search
- Git-backed atomic writes with index.md and log.md maintenance
- Read-only raw source access with path traversal protection
- Starter wiki template with `AGENTS.md`

### Packages

- `@jlnkrth/llm-wiki-core` — core library
- `@jlnkrth/llm-wiki-mcp` — MCP server (stdio + HTTP)
