import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cleanupSyntheticUser, type FetchLike } from '../support/cleanup';
import { pruneArtifacts, safeArtifactStem, writeFailureReport } from '../support/artifacts';
import { createRunId, createSyntheticEmail, isSyntheticEmail } from '../support/synthetic-data';
import { assertRelativeArtifactPath, readProfile, validateSessionPolicy } from '../support/config-policy';
import alexTaylor from '../fixtures/users/alex-taylor.json';
const { findProfileTagViolations } = require('../scripts/profile-tag-policy');

test('shared synthetic demo password satisfies the current registration policy', () => {
  expect(alexTaylor.password).toHaveLength(22);
  expect(alexTaylor.password).toMatch(/[A-Z]/);
  expect(alexTaylor.password).toMatch(/[a-z]/);
  expect(alexTaylor.password).toMatch(/[0-9]/);
  expect(alexTaylor.password).toMatch(/[^A-Za-z0-9]/);
});

test('synthetic identities are collision-resistant and recognisably test-only', () => {
  const runId = createRunId('worker-3');
  const first = createSyntheticEmail(runId, 'registration');
  const second = createSyntheticEmail(runId, 'registration');

  expect(first).not.toBe(second);
  expect(isSyntheticEmail(first)).toBe(true);
  expect(isSyntheticEmail(second)).toBe(true);
  expect(isSyntheticEmail('person@example.com')).toBe(false);
  expect(first).toMatch(/^jsc-e2e-registration-[a-z0-9-]+@users\.jobseekercopilot\.test$/);
});

test('cleanup sends only a reserved synthetic identity to a local endpoint', async () => {
  const email = createSyntheticEmail('test-run');
  let request: { url: string; method?: string; body?: string } | undefined;
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    request = { url: input.toString(), method: init?.method, body: init?.body?.toString() };
    return new Response(null, { status: 204 });
  }) as FetchLike;

  await cleanupSyntheticUser(email, {
    enabled: true,
    baseUrl: 'http://127.0.0.1:8080',
    profile: 'e2e'
  }, fetchImpl);

  expect(request).toEqual({
    url: 'http://127.0.0.1:8080/internal/test-support/users/cleanup',
    method: 'POST',
    body: JSON.stringify({ email })
  });
});

test('cleanup refuses non-test users, demo runs, remote targets and disabled cleanup', async () => {
  const syntheticEmail = createSyntheticEmail('test-run');
  const neverFetch = (async () => { throw new Error('fetch must not be called'); }) as FetchLike;

  await expect(cleanupSyntheticUser('customer@example.com', {
    enabled: true, baseUrl: 'http://localhost:8080', profile: 'e2e'
  }, neverFetch)).rejects.toThrow('reserved synthetic namespace');
  await expect(cleanupSyntheticUser(syntheticEmail, {
    enabled: true, baseUrl: 'http://localhost:8080', profile: 'demo'
  }, neverFetch)).rejects.toThrow('not available to demo');
  await expect(cleanupSyntheticUser(syntheticEmail, {
    enabled: true, baseUrl: 'https://tests.example.com', profile: 'e2e'
  }, neverFetch)).rejects.toThrow('local HTTP loopback');
  await expect(cleanupSyntheticUser(syntheticEmail, {
    enabled: false, baseUrl: 'http://localhost:8080', profile: 'e2e'
  }, neverFetch)).rejects.toThrow('explicitly enabled');
});

test('failure artifacts are parallel-safe, private and bounded', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jsc-e2e-artifacts-'));
  try {
    const first = safeArtifactStem('Registration / invalid token');
    const second = safeArtifactStem('Registration / invalid token');
    expect(first).not.toBe(second);
    expect(first).toMatch(/^registration-invalid-token-[a-z0-9-]+$/);

    const reportPath = await writeFailureReport(directory, first, 'security');
    const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    expect(report).toEqual({ profile: 'security', failed: true });
    expect(await fs.stat(reportPath).then(stat => stat.mode & 0o777)).toBe(0o600);

    await fs.writeFile(path.join(directory, `${second}.png`), 'synthetic screenshot');
    await fs.writeFile(path.join(directory, 'old.zip'), 'synthetic trace');
    await pruneArtifacts(directory, 2);
    expect((await fs.readdir(directory))).toHaveLength(2);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('beta configuration rejects demo and reusable-session flags', () => {
  expect(() => validateSessionPolicy('security', true, true, false))
    .toThrow('Beta profiles cannot enable demo mode');
  expect(() => validateSessionPolicy('demo', false, true, false))
    .toThrow('Reusable browser sessions are allowed only in explicit demo mode');
  expect(() => readProfile('unknown')).toThrow('Unsupported E2E_PROFILE');
});

test('artifact paths reject absolute paths and traversal', () => {
  for (const artifactDir of ['/tmp/leak', '../outside']) {
    expect(() => assertRelativeArtifactPath('ARTIFACT_DIR', artifactDir))
      .toThrow('repository-relative path without traversal');
  }
  expect(() => assertRelativeArtifactPath('ARTIFACT_DIR', '.auth/failure', 'test-results'))
    .toThrow('must stay under test-results');
  expect(assertRelativeArtifactPath('ARTIFACT_DIR', 'test-results/failures', 'test-results'))
    .toBe('test-results/failures');
});

test('profile policy accepts one primary tag and rejects missing or overlapping tags', () => {
  const root = path.join(path.sep, 'suite', 'features');
  expect(findProfileTagViolations(root, [
    { path: path.join(root, 'smoke', 'safe.feature'), content: '@smoke @framework\nFeature: safe' },
    { path: path.join(root, 'journeys', 'demo.feature'), content: '@demo\nFeature: demo' }
  ])).toEqual([]);

  const violations = findProfileTagViolations(root, [
    { path: path.join(root, 'smoke', 'missing.feature'), content: 'Feature: missing' },
    { path: path.join(root, 'journeys', 'overlap.feature'), content: '@demo @security\nFeature: overlap' },
    { path: path.join(root, 'journeys', 'wrong.feature'), content: '@e2e\nFeature: wrong' }
  ]);
  expect(violations).toHaveLength(3);
  expect(violations.join('\n')).toContain('exactly one primary profile tag');
  expect(violations.join('\n')).toContain('belongs to @demo');
});
