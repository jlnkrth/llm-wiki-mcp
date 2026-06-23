#!/usr/bin/env node
// End-to-end smoke test against a temp wiki directory.

import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWikiStore } from '../packages/core/index.mjs';

const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-smoke-'));

await writeFile(join(dir, 'wiki.config.yaml'), `types:
  - concepts
  - sources
git:
  enabled: false
`);
await writeFile(join(dir, 'index.md'), '## Concepts\n');
await writeFile(join(dir, 'log.md'), '# Log\n');
await mkdir(join(dir, 'raw', 'articles'), { recursive: true });
await writeFile(join(dir, 'raw', 'articles', 'sample.md'), '# Sample\n\nSmoke test source content xyzzy.');
await mkdir(join(dir, 'wiki', 'concepts'), { recursive: true });

const store = await createWikiStore({ contentDir: dir });

// Raw read
const rawList = await store.listRaw();
if (!Array.isArray(rawList) || rawList.length !== 1) {
  console.error('FAIL: listRaw', rawList);
  process.exit(1);
}

const rawRead = await store.readRaw('articles/sample.md');
if (!rawRead.content?.includes('xyzzy')) {
  console.error('FAIL: readRaw', rawRead);
  process.exit(1);
}

// Write page
const put = await store.putPage('concepts', 'smoke-test', {
  frontmatter: { type: 'concept', slug: 'smoke-test', name: 'Smoke Test' },
  body: '# Smoke Test\n\nUnique search token plugh.',
  logEntry: { operation: 'smoke', description: 'smoke test run' },
  indexEntry: { section: 'Concepts', line: '- [[smoke-test]] — Smoke test concept.' },
});
if (!put.ok) {
  console.error('FAIL: putPage', put);
  process.exit(1);
}

// Search
const results = store.search('plugh');
if (!results.length || results[0].slug !== 'smoke-test') {
  console.error('FAIL: search', results);
  process.exit(1);
}

// Index
const index = store.getIndex();
if (!index.body?.includes('smoke-test')) {
  console.error('FAIL: getIndex', index);
  process.exit(1);
}

console.log('OK: smoke test passed');
process.exit(0);
