import * as fs from 'fs';
import * as path from 'path';

import type { Download } from '@playwright/test';

/** Filesystem-safe, readable name for a downloaded file. */
export function slugify(value: string, maxLength = 80): string {
  const slug = (value || 'untitled')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '');
  return (slug || 'untitled').slice(0, maxLength);
}

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export interface SavedDownload {
  filePath: string;
  suggestedName: string;
  bytes: number;
}

/**
 * Saves a download that the caller has already captured.
 *
 * Split from the waiting deliberately. Tableau's View Data opens in a NEW tab,
 * but the download event fires on the tab that OPENED it - so whoever owns the
 * opener has to arm the wait, and only the saving belongs here.
 */
export async function saveCapturedDownload(
  download: Download,
  options: { targetDir: string; baseName: string },
): Promise<SavedDownload> {
  ensureDir(options.targetDir);

  const suggestedName = download.suggestedFilename();
  const extension = path.extname(suggestedName) || '.csv';
  const filePath = path.join(options.targetDir, `${slugify(options.baseName)}${extension}`);

  await download.saveAs(filePath);
  const failure = await download.failure();
  if (failure) throw new Error(`Download failed for "${options.baseName}": ${failure}`);

  const bytes = fs.statSync(filePath).size;
  if (bytes === 0) throw new Error(`Download for "${options.baseName}" is empty (0 bytes): ${filePath}`);

  return { filePath, suggestedName, bytes };
}

/**
 * Empties a directory, keeping the directory itself.
 *
 * Guarded on purpose: this deletes files, so it refuses anything that is not a
 * subdirectory of the project. A mistyped or absolute path in a constant would
 * otherwise wipe something unrelated.
 */
export function clearDirectory(dir: string): number {
  const resolved = path.resolve(dir);
  const root = path.resolve(process.cwd());

  if (resolved === root || !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to clear "${resolved}" - it is not a subdirectory of the project (${root})`);
  }

  if (!fs.existsSync(resolved)) {
    ensureDir(resolved);
    return 0;
  }

  const entries = fs.readdirSync(resolved);
  for (const entry of entries) {
    fs.rmSync(path.join(resolved, entry), { recursive: true, force: true });
  }
  return entries.length;
}
