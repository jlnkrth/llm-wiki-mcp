// wiki-api — HTTP API over an LLM-maintained markdown wiki.
// Internal-only in Docker deployments; auth is enforced by llm-wiki-mcp.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createWikiStore } from '@jlnkrth/llm-wiki-core';

const PORT = Number(process.env.PORT ?? 8085);
const HOST = process.env.HOST ?? '0.0.0.0';
const WIKI_CONTENT_DIR = process.env.WIKI_CONTENT_DIR ?? '/content';
const REFRESH_INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MS ?? 5 * 60 * 1000);

const store = await createWikiStore({
  contentDir: WIKI_CONTENT_DIR,
  logger: {
    warn: (obj, msg) => console.warn(msg, obj),
    error: (obj, msg) => console.error(msg, obj),
    info: () => {},
  },
});
store.startRefreshInterval(REFRESH_INTERVAL_MS);

const fastify = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  bodyLimit: 4 * 1024 * 1024,
});
await fastify.register(cors, { origin: '*' });

fastify.get('/health', async () => ({
  service: 'llm-wiki-api',
  ...store.getHealth(),
}));

fastify.get('/index', async (_req, reply) => {
  const data = store.getIndex();
  if (data.error) {
    reply.code(404);
  }
  return data;
});

fastify.get('/pages', async (req) => store.listPages(null));

fastify.get('/pages/:type', async (req, reply) => {
  const data = store.listPages(req.params.type);
  if (data.error) {
    reply.code(404);
  }
  return data;
});

fastify.get('/pages/:type/:slug', async (req, reply) => {
  const data = store.getPage(req.params.type, req.params.slug);
  if (data.error === 'invalid_type') reply.code(404);
  else if (data.error) reply.code(404);
  return data;
});

fastify.get('/search', async (req, reply) => {
  const data = store.search(req.query?.q, req.query?.type ?? null, req.query?.limit);
  if (data.error === 'q_required') reply.code(400);
  else if (data.error === 'invalid_type') reply.code(400);
  return data;
});

fastify.put('/pages/:type/:slug', async (req, reply) => {
  const data = await store.putPage(req.params.type, req.params.slug, req.body ?? {});
  if (data.error === 'invalid_type' || data.error === 'invalid_slug' || data.error === 'body_required') {
    reply.code(400);
  } else if (data.error) {
    reply.code(500);
  }
  return data;
});

fastify.get('/raw', async (req, reply) => {
  const data = await store.listRaw(req.query?.prefix ?? null, req.query?.limit);
  if (data.error === 'invalid_prefix') reply.code(400);
  return data;
});

fastify.get('/raw/*', async (req, reply) => {
  const path = req.params['*'];
  const data = await store.readRaw(path);
  if (data.error === 'invalid_path') reply.code(400);
  else if (data.error === 'not_found' || data.error === 'not_a_file') reply.code(404);
  else if (data.error === 'file_too_large') reply.code(413);
  return data;
});

await fastify.listen({ host: HOST, port: PORT });
fastify.log.info(
  { pages: store.getHealth().pages, port: PORT, content: WIKI_CONTENT_DIR },
  'llm-wiki-api ready',
);
