import { readFile, writeFile } from 'node:fs/promises';

// Insert `entry.line` into `index.md` under the section named `entry.section`
// (matched against `## <section>` headings, case-insensitive). Idempotent.
export async function updateIndexFile(indexPath, entry) {
  const raw = await readFile(indexPath, 'utf8').catch(() => '');
  const newLine = String(entry.line ?? '').trim();
  if (!newLine) return { changed: false, reason: 'empty_line' };

  const lines = raw.split(/\n/);
  if (lines.some((l) => l === newLine)) {
    return { changed: false, reason: 'line_already_present' };
  }

  const section = String(entry.section ?? '').trim();
  if (!section) return { changed: false, reason: 'empty_section' };

  const sectionIdx = lines.findIndex(
    (l) => l.trim().replace(/^##\s+/, '').toLowerCase() === section.toLowerCase(),
  );

  if (sectionIdx === -1) {
    if (lines.length && lines[lines.length - 1] !== '') lines.push('');
    lines.push(`## ${section}`, '', newLine);
  } else {
    let endIdx = lines.length;
    for (let i = sectionIdx + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i])) { endIdx = i; break; }
    }
    let insertAt = endIdx;
    while (insertAt > sectionIdx + 1 && lines[insertAt - 1].trim() === '') insertAt--;
    lines.splice(insertAt, 0, newLine);
  }

  await writeFile(indexPath, lines.join('\n'), 'utf8');
  return { changed: true };
}
