# Deploy — LLM Wiki MCP

Self-contained Docker stack: **Caddy** → **llm-wiki-mcp** → **llm-wiki-api** → wiki git repo.

## Prerequisites

- Docker and Docker Compose
- A wiki directory (copy from `../examples/starter-wiki` or use your own)
- For git push from the API container: mount an SSH key authorized on your remote

## Setup

```bash
cd deploy
cp .env.example .env
```

Edit `.env`:

| Variable | Purpose |
|---|---|
| `MCP_API_KEY` | Required. Shared secret for `X-Api-Key` header |
| `MCP_ALLOWED_ORIGINS` | Optional Origin allowlist |
| `WIKI_CONTENT_HOST_PATH` | Host path to wiki repo (default: `../examples/starter-wiki`) |

```bash
docker compose up -d --build
```

## Endpoints

| URL | Purpose |
|---|---|
| `POST /wiki-mcp/mcp` | Streamable HTTP MCP (requires `X-Api-Key`) |
| `GET /wiki-mcp/health` | MCP liveness |

The API (`llm-wiki-api`) is internal-only on the Docker network.

## Cursor config

See [`../examples/cursor-mcp-http.json`](../examples/cursor-mcp-http.json).

## Git push (optional)

To enable commit + push from `wiki_put_page`:

1. Ensure `git.enabled: true` in the wiki's `wiki.config.yaml`
2. Mount the wiki repo read-write (default)
3. Mount an SSH key into `llm-wiki-api` if pushing to a remote (extend `docker-compose.yml` as needed)

For local-only writes without push, set `git.enabled: false` in `wiki.config.yaml`.

## HTTPS

Replace the `:80` block in `Caddyfile` with your domain name. Caddy will obtain Let's Encrypt certificates automatically once DNS points at the server.
