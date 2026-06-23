import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerWikiTools } from '../tools.mjs';

test('registerWikiTools registers 7 tools', async () => {
  const registered = [];
  const mockServer = {
    registerTool(name, _meta, _handler) {
      registered.push(name);
    },
  };

  registerWikiTools(mockServer, {
    types: ['entities', 'concepts'],
    handlers: {
      getIndex: async () => ({}),
      listPages: async () => [],
      getPage: async () => ({}),
      search: async () => [],
      putPage: async () => ({}),
      listRaw: async () => [],
      readRaw: async () => ({}),
    },
  });

  assert.equal(registered.length, 7);
  assert.deepEqual(registered, [
    'wiki_get_index',
    'wiki_list_pages',
    'wiki_get_page',
    'wiki_search',
    'wiki_put_page',
    'wiki_list_raw',
    'wiki_read_raw',
  ]);
});
