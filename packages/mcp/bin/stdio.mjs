#!/usr/bin/env node
// Local stdio MCP — reads/writes a wiki directory on disk via @llm-wiki/core.
// Env: WIKI_DIR (required) — path to the wiki repo root (contains wiki/, index.md, etc.)

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createWikiStore } from '@jlnkrth/llm-wiki-core';
import { registerWikiTools, handlersFromStore } from '../tools.mjs';

const WIKI_DIR = process.env.WIKI_DIR ?? '';
if (!WIKI_DIR) {
  console.error('FATAL: WIKI_DIR is not set. Point it at your wiki repo root.');
  process.exit(1);
}

const store = await createWikiStore({
  contentDir: WIKI_DIR,
  logger: {
    warn: (obj, msg) => console.error(msg, obj),
    error: (obj, msg) => console.error(msg, obj),
    info: () => {},
  },
});

store.startRefreshInterval();

const server = new McpServer({ name: 'llm-wiki', version: '0.1.0' });
registerWikiTools(server, {
  types: store.types,
  handlers: handlersFromStore(store),
});

const transport = new StdioServerTransport();
await server.connect(transport);
