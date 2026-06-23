import { readFile, readdir, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import MiniSearch from 'minisearch';
import { loadWikiConfig, validTypesSet } from './config.mjs';
import { SLUG_RE } from './constants.mjs';
import { updateIndexFile } from './index-utils.mjs';
import { listRaw, readRaw } from './raw-reader.mjs';

const execFileP = promisify(execFile);

function snippet(body, query, len = 200) {
  const lc = String(body).toLowerCase();
  const m = String(query).toLowerCase().match(/[a-z0-9]+/);
  if (!m) return body.slice(0, len);
  const i = lc.indexOf(m[0]);
  if (i < 0) return body.slice(0, len);
  const start = Math.max(0, i - 60);
  const end = Math.min(body.length, start + len);
  return (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

export class WikiStore {
  #contentDir;
  #config;
  #validTypes;
  #gitTimeoutMs;
  #logger;
  #pages = new Map();
  #indexPage = null;
  #searchIndex = null;
  #pagesCount = 0;
  #loadedAt = null;
  #refreshing = false;
  #lastError = null;
  #writeQueue = Promise.resolve();
  #refreshTimer = null;

  constructor(options) {
    this.#contentDir = options.contentDir;
    this.#config = options.config ?? null;
    this.#validTypes = options.validTypes ?? null;
    this.#gitTimeoutMs = options.gitTimeoutMs ?? 30_000;
    this.#logger = options.logger ?? { warn: () => {}, error: () => {}, info: () => {} };
  }

  get contentDir() {
    return this.#contentDir;
  }

  get config() {
    return this.#config;
  }

  get types() {
    return [...this.#validTypes];
  }

  async init() {
    this.#config = this.#config ?? await loadWikiConfig(this.#contentDir);
    this.#validTypes = this.#validTypes ?? validTypesSet(this.#config);
    await this.load();
  }

  async load() {
    if (this.#refreshing) return;
    this.#refreshing = true;
    try {
      const wikiDir = join(this.#contentDir, 'wiki');
      const indexPath = join(this.#contentDir, 'index.md');
      const newPages = new Map();

      for (const file of await walk(wikiDir)) {
        const rel = file.slice(wikiDir.length + 1);
        const parts = rel.split(sep);
        if (parts.length !== 2) continue;
        const type = parts[0];
        if (!this.#validTypes.has(type)) continue;
        const slug = parts[1].replace(/\.md$/, '');
        try {
          const raw = await readFile(file, 'utf8');
          const parsed = matter(raw);
          newPages.set(`${type}/${slug}`, {
            slug,
            type,
            path: rel,
            frontmatter: parsed.data ?? {},
            body: parsed.content ?? '',
          });
        } catch {
          // skip unreadable file
        }
      }

      let newIndex = null;
      try {
        const raw = await readFile(indexPath, 'utf8');
        const parsed = matter(raw);
        newIndex = { frontmatter: parsed.data ?? {}, body: parsed.content ?? '' };
      } catch {
        // index.md is optional
      }

      const ms = new MiniSearch({
        fields: ['name', 'slug', 'type', 'tags', 'body'],
        storeFields: ['slug', 'type', 'name'],
        idField: 'id',
        tokenize: (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
      });
      const docs = [];
      for (const [key, p] of newPages) {
        docs.push({
          id: key,
          slug: p.slug,
          type: p.type,
          name: p.frontmatter.name ?? p.slug,
          tags: Array.isArray(p.frontmatter.tags)
            ? p.frontmatter.tags.join(' ')
            : (p.frontmatter.tags ?? ''),
          body: p.body,
        });
      }
      ms.addAll(docs);

      this.#pages = newPages;
      this.#indexPage = newIndex;
      this.#searchIndex = ms;
      this.#pagesCount = newPages.size;
      this.#loadedAt = new Date().toISOString();
      this.#lastError = null;
    } catch (e) {
      this.#lastError = String(e?.message ?? e);
      throw e;
    } finally {
      this.#refreshing = false;
    }
  }

  startRefreshInterval(ms) {
    const interval = ms ?? this.#config.search.refresh_interval_ms;
    if (this.#refreshTimer) clearInterval(this.#refreshTimer);
    this.#refreshTimer = setInterval(() => {
      this.load().catch((e) => this.#logger.error({ err: e }, 'refresh failed'));
    }, interval);
    if (this.#refreshTimer.unref) this.#refreshTimer.unref();
  }

  getHealth() {
    return {
      status: 'ok',
      pages: this.#pagesCount,
      loaded_at: this.#loadedAt,
      refreshing: this.#refreshing,
      last_error: this.#lastError,
      branch: this.#config.git.branch,
      git_enabled: this.#config.git.enabled,
      types: [...this.#validTypes],
    };
  }

  getIndex() {
    if (!this.#indexPage) {
      return { error: 'index_not_found' };
    }
    return this.#indexPage;
  }

  listPages(typeFilter = null) {
    if (typeFilter && !this.#validTypes.has(typeFilter)) {
      return { error: 'invalid_type', type: typeFilter };
    }
    const list = [];
    for (const p of this.#pages.values()) {
      if (typeFilter && p.type !== typeFilter) continue;
      const f = p.frontmatter ?? {};
      const entry = { slug: p.slug, type: p.type, name: f.name ?? p.slug };
      if (f.last_updated) entry.last_updated = f.last_updated;
      if (f.status) entry.status = f.status;
      list.push(entry);
    }
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return list;
  }

  getPage(type, slug) {
    if (!this.#validTypes.has(type)) {
      return { error: 'invalid_type', type };
    }
    const p = this.#pages.get(`${type}/${slug}`);
    if (!p) {
      return { error: 'not_found', type, slug };
    }
    return p;
  }

  search(q, typeFilter = null, limit = 20) {
    const query = String(q ?? '').trim();
    if (!query) {
      return { error: 'q_required' };
    }
    if (typeFilter && !this.#validTypes.has(typeFilter)) {
      return { error: 'invalid_type', type: typeFilter };
    }
    if (!this.#searchIndex) return [];
    const capped = Math.min(parseInt(String(limit), 10) || 20, 100);
    let results = this.#searchIndex.search(query, { prefix: true, fuzzy: 0.2 });
    if (typeFilter) results = results.filter((r) => r.type === typeFilter);
    results = results.slice(0, capped);
    return results.map((r) => {
      const p = this.#pages.get(`${r.type}/${r.slug}`);
      return {
        slug: r.slug,
        type: r.type,
        name: r.name,
        score: r.score,
        snippet: p ? snippet(p.body, query) : '',
      };
    });
  }

  #withWriteLock(fn) {
    const next = this.#writeQueue.then(fn, fn);
    this.#writeQueue = next.catch(() => null);
    return next;
  }

  async #gitRun(...args) {
    return await execFileP('git', ['-C', this.#contentDir, ...args], {
      timeout: this.#gitTimeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    });
  }

  putPage(type, slug, payload) {
    if (!this.#validTypes.has(type)) {
      return Promise.resolve({ error: 'invalid_type', type });
    }
    if (!SLUG_RE.test(slug)) {
      return Promise.resolve({ error: 'invalid_slug', slug });
    }
    if (typeof payload.body !== 'string') {
      return Promise.resolve({ error: 'body_required', detail: '`body` (markdown string) is required' });
    }

    const frontmatter = (payload.frontmatter && typeof payload.frontmatter === 'object')
      ? payload.frontmatter
      : {};
    const prefix = this.#config.git.commit_prefix;
    const commitMessage = String(payload.commitMessage ?? `${prefix} update ${type}/${slug}`).slice(0, 500);
    const logEntry = (payload.logEntry && typeof payload.logEntry === 'object') ? payload.logEntry : null;
    const indexEntry = (payload.indexEntry && typeof payload.indexEntry === 'object'
      && typeof payload.indexEntry.section === 'string'
      && typeof payload.indexEntry.line === 'string') ? payload.indexEntry : null;

    const fileContent = matter.stringify(payload.body, frontmatter);
    const relPath = `wiki/${type}/${slug}.md`;
    const absDir = join(this.#contentDir, 'wiki', type);
    const absPath = join(absDir, `${slug}.md`);
    const branch = this.#config.git.branch;
    const gitEnabled = this.#config.git.enabled;

    return this.#withWriteLock(async () => {
      let committed = false;
      try {
        if (gitEnabled) {
          try {
            await this.#gitRun('pull', '--ff-only', 'origin', branch);
          } catch (e) {
            this.#logger.warn({ err: String(e?.message ?? e) }, 'pre-write pull failed');
          }
        }

        await mkdir(absDir, { recursive: true });
        await writeFile(absPath, fileContent, 'utf8');

        if (logEntry) {
          const date = new Date().toISOString().slice(0, 10);
          const op = String(logEntry.operation ?? 'update');
          const desc = String(logEntry.description ?? `${type}/${slug}`);
          const detail = logEntry.detail ? `\n${String(logEntry.detail)}\n` : '\n';
          const line = `\n## [${date}] ${op} | ${desc}${detail}`;
          await appendFile(join(this.#contentDir, 'log.md'), line, 'utf8');
        }

        if (indexEntry) {
          await updateIndexFile(join(this.#contentDir, 'index.md'), indexEntry);
        }

        if (!gitEnabled) {
          await this.load();
          return { ok: true, status: 'written', path: relPath, branch: null };
        }

        await this.#gitRun('add', '-A');
        const status = await this.#gitRun('status', '--porcelain');
        if (!status.stdout.trim()) {
          return { ok: true, status: 'no_change', path: relPath, branch };
        }

        await this.#gitRun('commit', '-m', commitMessage);
        committed = true;

        try {
          await this.#gitRun('push', 'origin', branch);
        } catch (pushErr) {
          this.#logger.warn({ err: String(pushErr?.message ?? pushErr) }, 'push failed, retrying after rebase');
          await this.#gitRun('pull', '--rebase', 'origin', branch);
          await this.#gitRun('push', 'origin', branch);
        }

        const sha = (await this.#gitRun('rev-parse', '--short', 'HEAD')).stdout.trim();
        await this.load();
        return { ok: true, status: 'committed', sha, path: relPath, branch };
      } catch (e) {
        if (gitEnabled) {
          const rollbackTarget = committed ? 'HEAD~1' : 'HEAD';
          try {
            await this.#gitRun('reset', '--hard', rollbackTarget);
          } catch (rbErr) {
            this.#logger.error(
              { err: String(rbErr?.message ?? rbErr), target: rollbackTarget },
              'rollback failed',
            );
          }
        }
        this.#logger.error({ err: String(e?.message ?? e), committed }, 'write failed');
        return { error: 'write_failed', detail: String(e?.message ?? e) };
      }
    });
  }

  listRaw(prefix = null, limit = 100) {
    return listRaw(this.#contentDir, { prefix: prefix ?? '', limit });
  }

  readRaw(path) {
    return readRaw(this.#contentDir, path);
  }
}

export async function createWikiStore(options) {
  const store = new WikiStore(options);
  await store.init();
  return store;
}

export { SLUG_RE, updateIndexFile, loadWikiConfig, validTypesSet, listRaw, readRaw };
