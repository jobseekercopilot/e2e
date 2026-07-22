import { randomBytes, randomUUID } from 'node:crypto';

export const SYNTHETIC_EMAIL_DOMAIN = 'users.jobseekercopilot.test';
export const SYNTHETIC_EMAIL_PREFIX = 'jsc-e2e-';

function normaliseSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'run';
}

export function createRunId(workerIndex = process.env.CUCUMBER_WORKER_ID ?? '0'): string {
  return `${Date.now().toString(36)}-${normaliseSegment(workerIndex)}-${randomBytes(4).toString('hex')}`;
}

export function createSyntheticEmail(runId: string, purpose = 'user'): string {
  return `${SYNTHETIC_EMAIL_PREFIX}${normaliseSegment(purpose)}-${normaliseSegment(runId)}-${randomUUID().slice(0, 8)}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isSyntheticEmail(email: string): boolean {
  const normalised = email.trim().toLowerCase();
  const [local, domain, extra] = normalised.split('@');
  return extra === undefined && local.startsWith(SYNTHETIC_EMAIL_PREFIX) && domain === SYNTHETIC_EMAIL_DOMAIN;
}
