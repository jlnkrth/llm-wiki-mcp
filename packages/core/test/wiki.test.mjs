import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { updateIndexFile } from '../index-utils.mjs';
import { SLUG_RE } from '../constants.mjs';
import { createWikiStore } from '../wiki-store.mjs';

test('SLUG_RE accepts kebab-case slugs', () => {
  assert.ok(SLUG_RE.test('my-page'));
  assert.ok(SLUG_RE.test('entity_1'));
  assert.ok(!SLUG_RE.test('-bad'));
  assert.ok(!SLUG_RE.test(''));
});

test('updateIndexFile inserts under existing section', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-'));
  const indexPath = join(dir, 'index.md');
  await writeFile(indexPath, '## Concepts\n\n- [[existing]]\n');

  const result = await updateIndexFile(indexPath, {
    section: 'Concepts',
    line: '- [[new-one]] — A new concept.',
  });
  assert.equal(result.changed, true);

  const content = await readFile(indexPath, 'utf8');
  assert.match(content, /- \[\[new-one\]\]/);
  assert.match(content, /- \[\[existing\]\]/);
});

test('updateIndexFile is idempotent for duplicate lines', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-'));
  const indexPath = join(dir, 'index.md');
  const line = '- [[dup]] — Same line.';
  await writeFile(indexPath, `## Topics\n\n${line}\n`);

  const result = await updateIndexFile(indexPath, { section: 'Topics', line });
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'line_already_present');
});

test('updateIndexFile appends new section when missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-'));
  const indexPath = join(dir, 'index.md');
  await writeFile(indexPath, '## Entities\n');

  await updateIndexFile(indexPath, {
    section: 'Sources',
    line: '- [[paper-x]] — Summary.',
  });

  const content = await readFile(indexPath, 'utf8');
  assert.match(content, /## Sources/);
  assert.match(content, /- \[\[paper-x\]\]/);
});

test('WikiStore putPage writes without git when disabled', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-'));
  await writeFile(join(dir, 'wiki.config.yaml'), 'types:\n  - concepts\ngit:\n  enabled: false\n');
  await writeFile(join(dir, 'index.md'), '## Concepts\n');
  await writeFile(join(dir, 'log.md'), '# Log\n');

  const store = await createWikiStore({ contentDir: dir });
  const result = await store.putPage('concepts', 'test-page', {
    frontmatter: { type: 'concept', slug: 'test-page', name: 'Test' },
    body: '# Test\n\nBody content.',
    logEntry: { operation: 'test', description: 'write test' },
    indexEntry: { section: 'Concepts', line: '- [[test-page]] — Test.' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'written');

  const page = store.getPage('concepts', 'test-page');
  assert.equal(page.body.trim(), '# Test\n\nBody content.');
  assert.equal(store.listPages('concepts').length, 1);

  const log = await readFile(join(dir, 'log.md'), 'utf8');
  assert.match(log, /write test/);
});

test('WikiStore search finds page content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-'));
  await writeFile(join(dir, 'wiki.config.yaml'), 'types:\n  - topics\n');
  const wikiDir = join(dir, 'wiki', 'topics');
  await mkdir(wikiDir, { recursive: true });
  await writeFile(join(wikiDir, 'search-me.md'), '---\ntype: topic\nslug: search-me\nname: Search Me\n---\n\nUnique phrase xyzzyplugh.\n');

  const store = await createWikiStore({ contentDir: dir });
  const results = store.search('xyzzyplugh');
  assert.ok(Array.isArray(results));
  assert.equal(results.length, 1);
  assert.equal(results[0].slug, 'search-me');
});
