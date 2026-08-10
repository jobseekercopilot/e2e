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

export async function makeArtifactPrivate(artifactPath: string): Promise<void> {
  await fs.chmod(artifactPath, 0o600);
}

export interface BrowserNetworkSample {
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  failure?: string;
}

export interface ScenarioEvidence {
  scenario?: string;
  tags?: string[];
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  consoleErrors?: string[];
  networkErrors?: BrowserNetworkSample[];
}

function boundedText(value: string, maximum = 500): string {
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maximum);
}

export function safeRequestUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return 'invalid-url';
  }
}

export function boundedEvidence(evidence: ScenarioEvidence): ScenarioEvidence {
  return {
    ...evidence,
    scenario: evidence.scenario ? boundedText(evidence.scenario, 160) : undefined,
    error: evidence.error ? boundedText(evidence.error) : undefined,
    tags: evidence.tags?.slice(0, 20).map(tag => boundedText(tag, 80)),
    consoleErrors: evidence.consoleErrors?.slice(-20).map(message => boundedText(message)),
    networkErrors: evidence.networkErrors?.slice(-20).map(sample => ({
      ...sample,
      url: safeRequestUrl(sample.url),
      failure: sample.failure ? boundedText(sample.failure, 240) : undefined
    }))
  };
}

export async function writeFailureReport(
  directory: string,
  stem: string,
  profile: string,
  evidence: ScenarioEvidence = {}
): Promise<string> {
  const reportPath = path.join(directory, `${stem}.json`);
  const details = boundedEvidence(evidence);
  const report = Object.keys(details).length === 0
    ? { profile, failed: true }
    : { profile, failed: true, ...details };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return reportPath;
}

export async function writeCapacityScenarioReport(
  directory: string,
  stem: string,
  report: Record<string, unknown>
): Promise<string> {
  await fs.mkdir(directory, { recursive: true });
  const reportPath = path.join(directory, `${stem}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600
  });
  return reportPath;
}
