# LLM Wiki MCP

MCP server for **LLM-maintained markdown wikis** — a persistent, compounding knowledge base instead of per-query RAG.

Inspired by [Andrej Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). The LLM incrementally builds and maintains interlinked markdown pages; you curate sources and ask questions; the wiki stays current because maintenance cost is near zero.

## Three layers

| Layer | Path | Who writes |
|---|---|---|
| Raw sources | `raw/` | You (immutable) |
| Wiki | `wiki/{type}/{slug}.md` | LLM via MCP |
| Schema | `AGENTS.md` | You + LLM |

Plus `index.md` (catalog) and `log.md` (timeline), maintained automatically on writes.

## MCP tools

| Tool | Description |
|---|---|
| `wiki_get_index` | Read master `index.md` |
| `wiki_list_pages` | List pages, optional type filter |
| `wiki_get_page` | Fetch one page (frontmatter + body) |
| `wiki_search` | Full-text search with snippets |
| `wiki_list_raw` | List immutable source files in `raw/` |
| `wiki_read_raw` | Read a raw source file (text or binary metadata) |
| `wiki_put_page` | Create/update page + optional log/index/git commit |

## Quick start

### 1. Create your wiki from the starter template

```bash
cp -r examples/starter-wiki ~/my-wiki
cd ~/my-wiki
git init
git add . && git commit -m "Initial wiki scaffold"
```

### 2. Configure Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "llm-wiki": {
      "command": "npx",
      "args": ["-y", "@jlnkrth/llm-wiki-mcp"],
      "env": { "WIKI_DIR": "/path/to/my-wiki" }
    }
  }
}
```

Restart Cursor. Copy [`examples/starter-wiki/AGENTS.md`](examples/starter-wiki/AGENTS.md) conventions into your wiki (included if you copied the starter).

### 3. Local development (from source)

```bash
git clone https://github.com/jlnkrth/llm-wiki-mcp.git
cd llm-wiki-mcp
npm install
WIKI_DIR=/path/to/my-wiki npm run start:stdio
```

See [TESTING.md](TESTING.md) for the full test checklist.

## Remote deployment (HTTP + Docker)

For team/shared wikis on a VPS:

```bash
cd deploy
cp .env.example .env
docker compose up -d --build
```

MCP endpoint: `http://<host>/wiki-mcp/mcp` with header `X-Api-Key: <MCP_API_KEY>`.

See [`deploy/README.md`](deploy/README.md) for details.

## Configuration

`wiki.config.yaml` in your wiki root:

```yaml
types:
  - entities
  - concepts
  - sources
  - synthesis
  - topics
git:
  enabled: true    # false = local writes only, no commit/push
  branch: main
  commit_prefix: "wiki:"
search:
  refresh_interval_ms: 300000
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features (local image assets, rich query outputs, search upgrades).

## Why this works

RAG rediscovers knowledge on every question. An LLM wiki **compiles once and stays current** — cross-references exist, contradictions are flagged, synthesis reflects everything you've read. The MCP is the safe write interface: single-writer lock, index/log maintenance, structured frontmatter.

Browse the wiki in Obsidian; let the agent maintain it.

## License

MIT
