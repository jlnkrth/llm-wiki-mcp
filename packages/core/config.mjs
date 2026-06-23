import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_CONFIG } from './constants.mjs';

export async function loadWikiConfig(contentDir) {
  const configPath = join(contentDir, 'wiki.config.yaml');
  let raw = null;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }

  let parsed;
  try {
    parsed = parseYaml(raw) ?? {};
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }

  const types = Array.isArray(parsed.types) && parsed.types.length > 0
    ? parsed.types.map(String)
    : DEFAULT_CONFIG.types;

  return {
    types,
    git: {
      enabled: parsed.git?.enabled ?? DEFAULT_CONFIG.git.enabled,
      branch: String(parsed.git?.branch ?? DEFAULT_CONFIG.git.branch),
      commit_prefix: String(parsed.git?.commit_prefix ?? DEFAULT_CONFIG.git.commit_prefix),
    },
    search: {
      refresh_interval_ms: Number(parsed.search?.refresh_interval_ms ?? DEFAULT_CONFIG.search.refresh_interval_ms),
    },
  };
}

export function validTypesSet(config) {
  return new Set(config.types);
}
