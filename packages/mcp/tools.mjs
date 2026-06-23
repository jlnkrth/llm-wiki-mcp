import { z } from 'zod';

function jsonResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function registerWikiTools(server, { types, handlers }) {
  const typeSchema = z.string().describe('Page type (subdir under wiki/).');
  const optionalTypeSchema = z.string().optional().describe('Restrict to one page type.');

  server.registerTool(
    'wiki_get_index',
    {
      title: 'Get wiki index',
      description:
        'Returns the master index.md (YAML frontmatter + markdown body). ' +
        'Read this first when navigating the wiki — it catalogs every page with links and summaries.',
      inputSchema: {},
    },
    async () => jsonResult(await handlers.getIndex()),
  );

  server.registerTool(
    'wiki_list_pages',
    {
      title: 'List wiki pages',
      description:
        'Lists wiki pages with slug, type, and name. Optionally filter by page type. ' +
        'Use to discover available slugs before calling wiki_get_page.',
      inputSchema: {
        type: optionalTypeSchema,
      },
    },
    async ({ type }) => jsonResult(await handlers.listPages(type)),
  );

  server.registerTool(
    'wiki_get_page',
    {
      title: 'Get a single wiki page',
      description:
        'Fetches one wiki page (parsed YAML frontmatter + markdown body). ' +
        'Use when you know the specific page you want.',
      inputSchema: {
        type: typeSchema,
        slug: z.string().describe('Page slug, kebab-case.'),
      },
    },
    async ({ type, slug }) => {
      if (!types.includes(type)) {
        return jsonResult({ error: 'invalid_type', type, valid_types: types });
      }
      return jsonResult(await handlers.getPage(type, slug));
    },
  );

  server.registerTool(
    'wiki_search',
    {
      title: 'Full-text search the wiki',
      description:
        'Search across all wiki pages. Returns ranked matches with a short snippet. ' +
        'Optionally filter by page type.',
      inputSchema: {
        q: z.string().describe('Search query.'),
        type: optionalTypeSchema,
        limit: z.number().int().min(1).max(100).optional().describe('Max results (default 20).'),
      },
    },
    async ({ q, type, limit }) => {
      if (type && !types.includes(type)) {
        return jsonResult({ error: 'invalid_type', type, valid_types: types });
      }
      return jsonResult(await handlers.search(q, type, limit));
    },
  );

  server.registerTool(
    'wiki_put_page',
    {
      title: 'Create or overwrite a wiki page',
      description:
        'Write a single wiki page. Atomically writes the file, optionally appends to log.md ' +
        'and inserts into index.md, then commits to git when enabled. ' +
        'Use this whenever you need to create or update wiki content — never edit files directly.',
      inputSchema: {
        type: typeSchema,
        slug: z.string().describe('Page slug, kebab-case. Must match /^[a-z0-9][a-z0-9_-]*$/i.'),
        frontmatter: z.record(z.any()).optional().describe('YAML frontmatter object.'),
        body: z.string().describe('Markdown body (no --- delimiters).'),
        commitMessage: z.string().optional().describe('Git commit message.'),
        logEntry: z.object({
          operation: z.string().describe('Short op tag, e.g. ingest, update, lint.'),
          description: z.string().describe('One-line summary for log.md.'),
          detail: z.string().optional().describe('Optional longer note.'),
        }).optional(),
        indexEntry: z.object({
          section: z.string().describe('## section heading in index.md to insert under.'),
          line: z.string().describe('Full markdown line to insert verbatim.'),
        }).optional(),
      },
    },
    async ({ type, slug, frontmatter, body, commitMessage, logEntry, indexEntry }) => {
      if (!types.includes(type)) {
        return jsonResult({ error: 'invalid_type', type, valid_types: types });
      }
      const result = await handlers.putPage(type, slug, {
        frontmatter,
        body,
        commitMessage,
        logEntry,
        indexEntry,
      });
      return jsonResult(result);
    },
  );

  server.registerTool(
    'wiki_list_raw',
    {
      title: 'List raw source files',
      description:
        'Lists immutable source files under raw/. Use before ingest to discover ' +
        'available sources. Optionally filter by path prefix (e.g. "articles").',
      inputSchema: {
        prefix: z.string().optional().describe('Path prefix under raw/ (e.g. "articles").'),
        limit: z.number().int().min(1).max(500).optional().describe('Max results (default 100).'),
      },
    },
    async ({ prefix, limit }) => jsonResult(await handlers.listRaw(prefix, limit)),
  );

  server.registerTool(
    'wiki_read_raw',
    {
      title: 'Read a raw source file',
      description:
        'Reads a single immutable source file from raw/. Returns text content for ' +
        'markdown/text files; returns metadata only for binary files (images, PDFs). ' +
        'Never modifies raw/ — read-only.',
      inputSchema: {
        path: z.string().describe('Path relative to raw/ (e.g. "articles/my-article.md").'),
      },
    },
    async ({ path }) => jsonResult(await handlers.readRaw(path)),
  );
}

export function handlersFromStore(store) {
  return {
    getIndex: () => store.getIndex(),
    listPages: (type) => store.listPages(type ?? null),
    getPage: (type, slug) => store.getPage(type, slug),
    search: (q, type, limit) => store.search(q, type ?? null, limit),
    putPage: (type, slug, payload) => store.putPage(type, slug, payload),
    listRaw: (prefix, limit) => store.listRaw(prefix ?? null, limit),
    readRaw: (path) => store.readRaw(path),
  };
}

export async function callWikiApi(baseUrl, path, opts = {}) {
  const { method = 'GET', body } = opts;
  const init = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(baseUrl + path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`wiki-api ${method} ${path} failed: HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

export function handlersFromApi(baseUrl) {
  return {
    getIndex: () => callWikiApi(baseUrl, '/index'),
    listPages: (type) => {
      const path = type ? `/pages/${encodeURIComponent(type)}` : '/pages';
      return callWikiApi(baseUrl, path);
    },
    getPage: (type, slug) => callWikiApi(baseUrl, `/pages/${type}/${encodeURIComponent(slug)}`),
    search: (q, type, limit) => {
      const params = new URLSearchParams({ q });
      if (type) params.set('type', type);
      if (limit) params.set('limit', String(limit));
      return callWikiApi(baseUrl, `/search?${params.toString()}`);
    },
    putPage: (type, slug, payload) => callWikiApi(baseUrl, `/pages/${type}/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: payload,
    }),
    listRaw: (prefix, limit) => {
      const params = new URLSearchParams();
      if (prefix) params.set('prefix', prefix);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return callWikiApi(baseUrl, `/raw${qs ? `?${qs}` : ''}`);
    },
    readRaw: (path) => callWikiApi(baseUrl, `/raw/${path.split('/').map(encodeURIComponent).join('/')}`),
  };
}
