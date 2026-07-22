import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function safeArtifactStem(name: string): string {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'scenario';
  return `${safeName}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export async function pruneArtifacts(directory: string, maximum: number): Promise<void> {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 100) {
    throw new Error('MAX_FAILURE_ARTIFACTS must be an integer from 1 to 100.');
  }
  await fs.mkdir(directory, { recursive: true });
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.filter(entry => entry.isFile()).map(async entry => ({
    path: path.join(directory, entry.name),
    modified: (await fs.stat(path.join(directory, entry.name))).mtimeMs
  })));
  files.sort((left, right) => right.modified - left.modified);
  await Promise.all(files.slice(maximum).map(file => fs.unlink(file.path)));
}

export async function writeFailureReport(directory: string, stem: string, profile: string): Promise<string> {
  const reportPath = path.join(directory, `${stem}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify({ profile, failed: true }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return reportPath;
}
