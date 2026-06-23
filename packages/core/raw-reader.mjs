import { readdir, readFile, stat } from 'node:fs/promises';
import { join, sep, normalize } from 'node:path';
import { realpath } from 'node:fs/promises';

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.csv', '.json', '.yaml', '.yml', '.html',
]);

const MAX_TEXT_BYTES = 1024 * 1024;

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function extname(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

async function walkRawFiles(dir, rawRoot, prefix = '') {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkRawFiles(abs, rawRoot, rel)));
    } else if (e.isFile()) {
      out.push({ abs, rel: rel.split(sep).join('/') });
    }
  }
  return out;
}

async function resolveRawPath(contentDir, userPath) {
  const rawRoot = join(contentDir, 'raw');
  const normalized = normalize(String(userPath ?? '').replace(/\\/g, '/'));
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('..')) {
    return { error: 'invalid_path', path: userPath };
  }
  const candidate = join(rawRoot, normalized);
  let rawReal;
  let fileReal;
  try {
    rawReal = await realpath(rawRoot);
    fileReal = await realpath(candidate);
  } catch {
    return { error: 'not_found', path: userPath };
  }
  if (!fileReal.startsWith(rawReal + sep) && fileReal !== rawReal) {
    return { error: 'invalid_path', path: userPath };
  }
  return { absPath: fileReal, relPath: normalized.split(sep).join('/') };
}

export async function listRaw(contentDir, options = {}) {
  const rawRoot = join(contentDir, 'raw');
  const prefix = String(options.prefix ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
  const limit = Math.min(parseInt(String(options.limit ?? '100'), 10) || 100, 500);

  if (prefix.includes('..')) {
    return { error: 'invalid_prefix', prefix };
  }

  const scanDir = prefix ? join(rawRoot, prefix) : rawRoot;
  let rawReal;
  let scanReal;
  try {
    rawReal = await realpath(rawRoot);
    scanReal = await realpath(scanDir);
  } catch {
    return [];
  }
  if (!scanReal.startsWith(rawReal + sep) && scanReal !== rawReal) {
    return { error: 'invalid_prefix', prefix };
  }

  const files = await walkRawFiles(scanDir, rawRoot, prefix);
  const list = [];
  for (const f of files) {
    try {
      const s = await stat(f.abs);
      list.push({
        path: f.rel,
        size: s.size,
        modified_at: s.mtime.toISOString(),
      });
    } catch {
      // skip
    }
  }
  list.sort((a, b) => a.path.localeCompare(b.path));
  return list.slice(0, limit);
}

export async function readRaw(contentDir, userPath) {
  const resolved = await resolveRawPath(contentDir, userPath);
  if (resolved.error) return resolved;

  let s;
  try {
    s = await stat(resolved.absPath);
  } catch {
    return { error: 'not_found', path: userPath };
  }
  if (!s.isFile()) {
    return { error: 'not_a_file', path: userPath };
  }

  const ext = extname(resolved.relPath);
  const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';

  if (!TEXT_EXTENSIONS.has(ext)) {
    return {
      path: resolved.relPath,
      content: null,
      encoding: null,
      mime,
      size: s.size,
      note: 'binary',
    };
  }

  if (s.size > MAX_TEXT_BYTES) {
    return { error: 'file_too_large', path: userPath, size: s.size, max_bytes: MAX_TEXT_BYTES };
  }

  const content = await readFile(resolved.absPath, 'utf8');
  return {
    path: resolved.relPath,
    content,
    encoding: 'utf8',
    mime,
    size: s.size,
  };
}
