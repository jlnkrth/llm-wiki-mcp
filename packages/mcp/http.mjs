// Streamable-HTTP MCP — thin proxy to wiki-api. Auth via X-Api-Key.

import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerWikiTools, callWikiApi, handlersFromApi } from './tools.mjs';

const PORT = Number(process.env.PORT ?? 8086);
const HOST = process.env.HOST ?? '0.0.0.0';
const WIKI_API_URL = (process.env.WIKI_API_URL ?? 'http://wiki-api:8085').replace(/\/$/, '');

const MCP_API_KEY = process.env.MCP_API_KEY ?? '';
const MCP_ALLOWED_ORIGINS = (process.env.MCP_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!MCP_API_KEY) {
  console.error(
    'FATAL: MCP_API_KEY is not set. Refusing to start a write-capable MCP server ' +
      'with no authentication. Set MCP_API_KEY (see deploy/.env.example).',
  );
  process.exit(1);
}

function keyMatches(provided) {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(MCP_API_KEY);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authGuard(req, res, next) {
  const origin = req.get('origin');
  if (origin && MCP_ALLOWED_ORIGINS.length > 0 && !MCP_ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'forbidden_origin' });
  }
  if (!keyMatches(req.get('x-api-key'))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}

let cachedTypes = null;

async function getTypes() {
  if (cachedTypes) return cachedTypes;
  const health = await callWikiApi(WIKI_API_URL, '/health');
  cachedTypes = health.types ?? [];
  return cachedTypes;
}

async function createServer() {
  const types = await getTypes();
  const s = new McpServer({ name: 'llm-wiki', version: '0.1.0' });
  registerWikiTools(s, {
    types,
    handlers: handlersFromApi(WIKI_API_URL),
  });
  return s;
}

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'llm-wiki-mcp', upstream: WIKI_API_URL });
});

app.post('/mcp', authGuard, async (req, res) => {
  try {
    const server = await createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('MCP error:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: 'mcp_error', detail: String(e?.message ?? e) });
    }
  }
});

app.get('/mcp', (_req, res) => {
  res.status(405).json({ error: 'method_not_allowed', detail: 'MCP requires POST.' });
});

app.listen(PORT, HOST, () => {
  const originNote = MCP_ALLOWED_ORIGINS.length
    ? `origin allowlist [${MCP_ALLOWED_ORIGINS.join(', ')}]`
    : 'origin allowlist off';
  console.log(
    `llm-wiki-mcp ready on ${HOST}:${PORT} → upstream ${WIKI_API_URL} ` +
      `(X-Api-Key required, ${originNote})`,
  );
});
