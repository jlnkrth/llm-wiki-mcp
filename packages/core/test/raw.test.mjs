import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listRaw, readRaw } from '../raw-reader.mjs';

test('listRaw returns files under raw/', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-raw-'));
  await mkdir(join(dir, 'raw', 'articles'), { recursive: true });
  await writeFile(join(dir, 'raw', 'articles', 'test.md'), '# Hello\n');

  const list = await listRaw(dir);
  assert.ok(Array.isArray(list));
  assert.equal(list.length, 1);
  assert.equal(list[0].path, 'articles/test.md');
});

test('readRaw returns text content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-raw-'));
  await mkdir(join(dir, 'raw'), { recursive: true });
  await writeFile(join(dir, 'raw', 'note.txt'), 'raw source text');

  const result = await readRaw(dir, 'note.txt');
  assert.equal(result.content, 'raw source text');
  assert.equal(result.encoding, 'utf8');
});

test('readRaw blocks path traversal', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-raw-'));
  await mkdir(join(dir, 'raw'), { recursive: true });
  await mkdir(join(dir, 'wiki'), { recursive: true });
  await writeFile(join(dir, 'wiki', 'secret.md'), 'secret');

  const result = await readRaw(dir, '../wiki/secret.md');
  assert.equal(result.error, 'invalid_path');
});

test('readRaw returns binary metadata for images', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-raw-'));
  await mkdir(join(dir, 'raw'), { recursive: true });
  await writeFile(join(dir, 'raw', 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const result = await readRaw(dir, 'photo.png');
  assert.equal(result.note, 'binary');
  assert.equal(result.content, null);
  assert.equal(result.mime, 'image/png');
});

test('listRaw filters by prefix', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'llm-wiki-raw-'));
  await mkdir(join(dir, 'raw', 'articles'), { recursive: true });
  await mkdir(join(dir, 'raw', 'misc'), { recursive: true });
  await writeFile(join(dir, 'raw', 'articles', 'a.md'), 'a');
  await writeFile(join(dir, 'raw', 'misc', 'b.md'), 'b');

  const list = await listRaw(dir, { prefix: 'articles' });
  assert.equal(list.length, 1);
  assert.equal(list[0].path, 'articles/a.md');
});
