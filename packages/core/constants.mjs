export const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/i;

export const DEFAULT_TYPES = [
  'entities',
  'concepts',
  'sources',
  'synthesis',
  'topics',
];

export const DEFAULT_CONFIG = {
  types: DEFAULT_TYPES,
  git: {
    enabled: true,
    branch: 'main',
    commit_prefix: 'wiki:',
  },
  search: {
    refresh_interval_ms: 300_000,
  },
};
