# Testing LLM Wiki MCP

## Automated tests

From the repo root:

```bash
npm install
npm test          # unit tests (core + mcp)
npm run test:smoke  # integration smoke test (temp wiki dir)
```

Release gate: both must pass before publishing.

## Manual Cursor smoke test

### 1. Prepare a wiki

```bash
cp -r examples/starter-wiki /tmp/my-wiki
cd /tmp/my-wiki
git init
git add . && git commit -m "Initial wiki scaffold"
```

For local dev without git commits, set in `wiki.config.yaml`:

```yaml
git:
  enabled: false
```

### 2. Configure Cursor

Merge into `~/.cursor/mcp.json` (use absolute paths):

```json
{
  "mcpServers": {
    "llm-wiki": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/llm-wiki-mcp/packages/mcp/bin/llm-wiki-mcp.js"],
      "env": { "WIKI_DIR": "/tmp/my-wiki" }
    }
  }
}
```

After npm publish, use:

```json
{
  "mcpServers": {
    "llm-wiki": {
      "command": "npx",
      "args": ["-y", "@jlnkrth/llm-wiki-mcp"],
      "env": { "WIKI_DIR": "/tmp/my-wiki" }
    }
  }
}
```

Restart Cursor (or reload MCP servers).

### 3. Verify tools

Confirm **7 tools** appear under `llm-wiki`:

- `wiki_get_index`
- `wiki_list_pages`
- `wiki_get_page`
- `wiki_search`
- `wiki_put_page`
- `wiki_list_raw`
- `wiki_read_raw`

### 4. Checklist prompts

Run these in Cursor chat:

| Step | Prompt |
|---|---|
| Index | "Call `wiki_get_index` and show me the result." |
| Raw ingest | Drop `raw/articles/test.md` with sample content, then: "Call `wiki_list_raw` and `wiki_read_raw` for the new file." |
| Write | "Create a concept page about LLM wikis via `wiki_put_page` with `indexEntry` and `logEntry`." |
| Search | "Search the wiki for 'LLM' using `wiki_search`." |
| Read back | "Call `wiki_get_page` for the concept you just created." |

### 5. Optional Docker smoke

```bash
cd deploy
cp .env.example .env
# Set MCP_API_KEY=dev-key-...
docker compose up --build
curl http://localhost/wiki-mcp/health
```

Not required for v0.1.0 release if stdio tests pass.
