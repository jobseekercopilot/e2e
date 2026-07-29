import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cleanupSyntheticUser, type FetchLike } from '../support/cleanup';
import {
  makeArtifactPrivate,
  pruneArtifacts,
  safeArtifactStem,
  writeFailureReport
} from '../support/artifacts';
import {
  StabilisationArtifacts,
  validateGeneratedDocumentText
} from '../support/stabilisation-artifacts';
import { createRunId, createSyntheticEmail, isSyntheticEmail } from '../support/synthetic-data';
import { assertRelativeArtifactPath, readProfile, validateSessionPolicy } from '../support/config-policy';
import {
  shouldPreserveDemoReady,
  validatePreservationConfiguration
} from '../support/stabilisation-preservation';
import {
  enforceStabilisationScenarioSafety,
  installGenerationStartBlocker,
  installZeroCreditGenerationFirewall
} from '../support/stabilisation-runtime-safety';
import {
  LIVE_CHECKPOINT_JOURNEY_COUNT,
  SINGLE_GENERATION_PROBE_JOURNEY_COUNT
} from '../pages/StabilisationPage';
import alexTaylor from '../fixtures/users/alex-taylor.json';
const { findProfileTagViolations } = require('../scripts/profile-tag-policy');
const {
  requireLoopbackApplication,
  requireLoopbackSystemData,
  requirePersistenceManifest,
  requireStabilisationArtifactDirectory,
  validateRestoredPersistenceSmoke,
  validateLiveStabilisation
} = require('../scripts/live-stabilisation-policy');
const {
  runLiveStabilisation
} = require('../scripts/run-live-stabilisation');
const cucumberProfiles = require('../cucumber');

test('shared synthetic demo password satisfies the current registration policy', () => {
  expect(alexTaylor.password).toHaveLength(22);
  expect(alexTaylor.password).toMatch(/[A-Z]/);
  expect(alexTaylor.password).toMatch(/[a-z]/);
  expect(alexTaylor.password).toMatch(/[0-9]/);
  expect(alexTaylor.password).toMatch(/[^A-Za-z0-9]/);
  expect(alexTaylor.homeLocation).toMatch(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/);
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

    const screenshotPath = path.join(directory, `${second}.png`);
    const tracePath = path.join(directory, 'old.zip');
    await fs.writeFile(screenshotPath, 'synthetic screenshot');
    await fs.writeFile(tracePath, 'synthetic trace');
    await makeArtifactPrivate(screenshotPath);
    await makeArtifactPrivate(tracePath);
    expect(await fs.stat(screenshotPath).then(stat => stat.mode & 0o777)).toBe(0o600);
    expect(await fs.stat(tracePath).then(stat => stat.mode & 0o777)).toBe(0o600);
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

test('job search opens the canonical application root', async () => {
  const pageObject = await fs.readFile(
    path.resolve(__dirname, '../pages/JobSearchPage.ts'),
    'utf8'
  );

  expect(pageObject).toContain("await this.page.goto('/');");
  expect(pageObject).not.toContain("await this.page.goto('/dashboard');");
});

test('live stabilisation is loopback-only and spending remains explicit', () => {
  expect(requireLoopbackApplication('http://localhost:3000')).toBe('http://localhost:3000');
  expect(() => requireLoopbackApplication('https://jobseekercopilot.example'))
    .toThrow('local HTTP application URL');
  expect(requireLoopbackSystemData('http://127.0.0.1:8103'))
    .toBe('http://127.0.0.1:8103');
  expect(() => requireLoopbackSystemData('https://system-data.example:8103'))
    .toThrow('HTTP loopback');
  expect(() => requireLoopbackSystemData('http://127.0.0.1:8080/internal'))
    .toThrow('HTTP loopback');

  const lifecycle = {
    E2E_BASE_URL: 'http://127.0.0.1:3000',
    SYSTEM_DATA_SERVICE_URL: 'http://localhost:8103',
    SYSTEM_DATA_INTERNAL_CALLER_KEY: 'x'.repeat(32)
  };
  expect(() => validateLiveStabilisation('ui', lifecycle))
    .toThrow('ALLOW_REAL_PROVIDER_E2E=true');
  const providerLifecycle = {
    ...lifecycle,
    ALLOW_REAL_PROVIDER_E2E: 'true'
  };
  expect(() => validateLiveStabilisation('checkpoint', providerLifecycle))
    .toThrow('ALLOW_AI_GENERATION=true');
  expect(validateLiveStabilisation('ui', providerLifecycle).profile)
    .toBe('stabilisationUi');
  expect(validateLiveStabilisation('stale', providerLifecycle).profile)
    .toBe('stabilisationStale');
  expect(() => validateLiveStabilisation('probe', providerLifecycle))
    .toThrow('ALLOW_AI_GENERATION=true');
  expect(() => validateLiveStabilisation('probe', {
    ...providerLifecycle,
    ALLOW_AI_GENERATION: 'true'
  })).toThrow('ALLOW_SINGLE_GENERATION_PROBE=true');
  expect(validateLiveStabilisation('probe', {
    ...providerLifecycle,
    ALLOW_AI_GENERATION: 'true',
    ALLOW_SINGLE_GENERATION_PROBE: 'true'
  }).profile).toBe('stabilisationProbe');
  expect(() => validateLiveStabilisation('ui', {
    ...providerLifecycle,
    ALLOW_AI_GENERATION: 'true'
  })).toThrow('zero-credit');
  expect(() => validateLiveStabilisation('cancellation', {
    ...providerLifecycle,
    ALLOW_AI_GENERATION: 'true'
  })).toThrow('ALLOW_CANCELLATION_E2E=true');
  expect(validateLiveStabilisation('checkpoint', {
    ...providerLifecycle,
    ALLOW_AI_GENERATION: 'true',
    PRESERVE_DEMO_READY_AFTER_RUN: 'true'
  })).toMatchObject({
    baseUrl: 'http://127.0.0.1:3000',
    systemDataUrl: 'http://localhost:8103',
    preserveDemoReady: true,
    profile: 'stabilisation'
  });
  expect(() => validateLiveStabilisation('ui', {
    ...providerLifecycle,
    PRESERVE_DEMO_READY_AFTER_RUN: 'true'
  })).toThrow('only to the live stabilisation checkpoint');
  expect(() => validateLiveStabilisation('stale', {
    ...providerLifecycle,
    PRESERVE_DEMO_READY_AFTER_RUN: 'true'
  })).toThrow('only to the live stabilisation checkpoint');
  expect(() => validateLiveStabilisation('probe', {
    ...providerLifecycle,
    ALLOW_AI_GENERATION: 'true',
    ALLOW_SINGLE_GENERATION_PROBE: 'true',
    PRESERVE_DEMO_READY_AFTER_RUN: 'true'
  })).toThrow('only to the live stabilisation checkpoint');
});

test('checkpoint prerequisites fail fast before the paid live phase', () => {
  const environment = {
    E2E_BASE_URL: 'http://127.0.0.1:3000',
    SYSTEM_DATA_SERVICE_URL: 'http://localhost:8103',
    SYSTEM_DATA_INTERNAL_CALLER_KEY: 'x'.repeat(32),
    ALLOW_REAL_PROVIDER_E2E: 'true',
    ALLOW_AI_GENERATION: 'true',
    PRESERVE_DEMO_READY_AFTER_RUN: 'true'
  };
  const run = (statuses: number[]) => {
    const calls: Array<{
      profile: string;
      allowAiGeneration: string;
      preserveDemoReady: string;
    }> = [];
    const errors: string[] = [];
    const status = runLiveStabilisation('checkpoint', environment, {
      spawnSync: (
        _command: string,
        args: string[],
        options: { env: Record<string, string> }
      ) => {
        calls.push({
          profile: args[args.indexOf('--profile') + 1],
          allowAiGeneration: options.env.ALLOW_AI_GENERATION,
          preserveDemoReady: options.env.PRESERVE_DEMO_READY_AFTER_RUN
        });
        return { status: statuses[calls.length - 1] };
      },
      reportError: (message: string) => errors.push(message)
    });
    return { calls, errors, status };
  };

  const uiFailure = run([7]);
  expect(uiFailure.status).toBe(7);
  expect(uiFailure.calls).toEqual([{
    profile: 'stabilisationUi',
    allowAiGeneration: 'false',
    preserveDemoReady: 'false'
  }]);
  expect(uiFailure.errors).toContain(
    'The ui prerequisite failed. Paid live generation was not started.'
  );

  const staleFailure = run([0, 8]);
  expect(staleFailure.status).toBe(8);
  expect(staleFailure.calls.map(call => call.profile)).toEqual([
    'stabilisationUi',
    'stabilisationStale'
  ]);
  expect(staleFailure.calls.every(call => call.allowAiGeneration === 'false'))
    .toBe(true);
  expect(staleFailure.errors).toContain(
    'The stale prerequisite failed. Paid live generation was not started.'
  );
});

test('checkpoint enables OpenAI only after both zero-credit prerequisites pass', () => {
  const environment = {
    E2E_BASE_URL: 'http://127.0.0.1:3000',
    SYSTEM_DATA_SERVICE_URL: 'http://localhost:8103',
    SYSTEM_DATA_INTERNAL_CALLER_KEY: 'x'.repeat(32),
    ALLOW_REAL_PROVIDER_E2E: 'true',
    ALLOW_AI_GENERATION: 'true',
    PRESERVE_DEMO_READY_AFTER_RUN: 'true'
  };
  const calls: Array<{
    profile: string;
    allowAiGeneration: string;
    preserveDemoReady: string;
  }> = [];
  const status = runLiveStabilisation('checkpoint', environment, {
    spawnSync: (
      _command: string,
      args: string[],
      options: { env: Record<string, string> }
    ) => {
      calls.push({
        profile: args[args.indexOf('--profile') + 1],
        allowAiGeneration: options.env.ALLOW_AI_GENERATION,
        preserveDemoReady: options.env.PRESERVE_DEMO_READY_AFTER_RUN
      });
      return { status: 0 };
    },
    reportError: () => undefined
  });

  expect(status).toBe(0);
  expect(calls).toEqual([
    {
      profile: 'stabilisationUi',
      allowAiGeneration: 'false',
      preserveDemoReady: 'false'
    },
    {
      profile: 'stabilisationStale',
      allowAiGeneration: 'false',
      preserveDemoReady: 'false'
    },
    {
      profile: 'stabilisation',
      allowAiGeneration: 'true',
      preserveDemoReady: 'true'
    }
  ]);
  expect(cucumberProfiles.stabilisation.tags)
    .toBe('@e2e and @stabilisation-live');
});

test('single-generation probe requires both gates and invokes only its one scenario', async () => {
  const environment = {
    E2E_BASE_URL: 'http://127.0.0.1:3000',
    SYSTEM_DATA_SERVICE_URL: 'http://localhost:8103',
    SYSTEM_DATA_INTERNAL_CALLER_KEY: 'x'.repeat(32),
    ALLOW_REAL_PROVIDER_E2E: 'true',
    ALLOW_AI_GENERATION: 'true',
    ALLOW_SINGLE_GENERATION_PROBE: 'true',
    PRESERVE_DEMO_READY_AFTER_RUN: 'false'
  };
  for (const blockedEnvironment of [
    {
      ...environment,
      ALLOW_AI_GENERATION: 'false'
    },
    {
      ...environment,
      ALLOW_SINGLE_GENERATION_PROBE: 'false'
    }
  ]) {
    let spawnCount = 0;
    const blockedStatus = runLiveStabilisation('probe', blockedEnvironment, {
      spawnSync: () => {
        spawnCount += 1;
        return { status: 0 };
      },
      reportError: () => undefined
    });
    expect(blockedStatus).toBe(1);
    expect(spawnCount).toBe(0);
  }

  const calls: Array<{
    profile: string;
    allowAiGeneration: string;
    allowSingleGenerationProbe: string;
    preserveDemoReady: string;
  }> = [];
  const status = runLiveStabilisation('probe', environment, {
    spawnSync: (
      _command: string,
      args: string[],
      options: { env: Record<string, string> }
    ) => {
      calls.push({
        profile: args[args.indexOf('--profile') + 1],
        allowAiGeneration: options.env.ALLOW_AI_GENERATION,
        allowSingleGenerationProbe:
          options.env.ALLOW_SINGLE_GENERATION_PROBE,
        preserveDemoReady: options.env.PRESERVE_DEMO_READY_AFTER_RUN
      });
      return { status: 0 };
    },
    reportError: () => undefined
  });

  expect(status).toBe(0);
  expect(calls).toEqual([{
    profile: 'stabilisationProbe',
    allowAiGeneration: 'true',
    allowSingleGenerationProbe: 'true',
    preserveDemoReady: 'false'
  }]);
  expect(cucumberProfiles.stabilisationProbe.tags)
    .toBe('@e2e and @stabilisation-probe');
  const feature = await fs.readFile(
    path.resolve(__dirname, '../features/e2e/stabilisation-live.feature'),
    'utf8'
  );
  expect(feature.match(/^\s*@stabilisation-probe\s*$/gm)).toHaveLength(1);
  expect(LIVE_CHECKPOINT_JOURNEY_COUNT).toBe(5);
  expect(SINGLE_GENERATION_PROBE_JOURNEY_COUNT).toBe(1);
});

test('Cucumber hooks enforce the bounded live runner and all external-call gates', () => {
  const tags = ['@e2e', '@stabilisation', '@stabilisation-live', '@state:DEMO_READY'];
  const safe = {
    profile: 'e2e',
    baseUrl: 'http://127.0.0.1:3000',
    systemDataUrl: 'http://localhost:8103',
    systemDataKey: 'x'.repeat(32),
    allowRealProviderE2e: true,
    allowAiGeneration: true,
    allowSingleGenerationProbe: false,
    allowCancellationE2e: false,
    liveStabilisationProfile: 'stabilisation'
  };
  expect(() => enforceStabilisationScenarioSafety(tags, {
    ...safe,
    liveStabilisationProfile: undefined
  })).toThrow('Direct Cucumber execution is blocked');
  expect(() => enforceStabilisationScenarioSafety(tags, {
    ...safe,
    allowRealProviderE2e: false
  })).toThrow('ALLOW_REAL_PROVIDER_E2E=true');
  expect(() => enforceStabilisationScenarioSafety(tags, {
    ...safe,
    allowAiGeneration: false
  })).toThrow('ALLOW_AI_GENERATION=true');
  expect(() => enforceStabilisationScenarioSafety(tags, safe)).not.toThrow();
  expect(() => enforceStabilisationScenarioSafety(
    ['@e2e', '@stabilisation', '@stabilisation-ui', '@state:DEMO_READY'],
    safe
  )).toThrow('cannot execute a stabilisationUi scenario');
  const probeTags = [
    '@e2e',
    '@stabilisation',
    '@stabilisation-probe',
    '@state:DEMO_READY'
  ];
  expect(() => enforceStabilisationScenarioSafety(probeTags, {
    ...safe,
    liveStabilisationProfile: 'stabilisationProbe'
  })).toThrow('ALLOW_SINGLE_GENERATION_PROBE=true');
  expect(() => enforceStabilisationScenarioSafety(probeTags, {
    ...safe,
    allowSingleGenerationProbe: true,
    liveStabilisationProfile: 'stabilisationProbe'
  })).not.toThrow();
  expect(() => enforceStabilisationScenarioSafety(
    ['@e2e', '@stabilisation', '@stabilisation-cancellation', '@state:DEMO_READY'],
    safe
  )).toThrow('separately authorised');
});

test('zero-credit stabilisation blocks and reports every generation start', async ({
  browser
}) => {
  const context = await browser.newContext();
  const firewall = await installZeroCreditGenerationFirewall(
    context,
    ['@e2e', '@stabilisation', '@stabilisation-ui', '@state:DEMO_READY']
  );
  expect(firewall).toBeDefined();
  try {
    firewall!.assertNoAttempts();
    const page = await context.newPage();
    await page.setContent('<main>zero-credit firewall probe</main>');
    const result = await page.evaluate(async () => {
      try {
        await fetch(
          'http://127.0.0.1:3000/api/v1/document-generation/saved-jobs/probe/operations',
          { method: 'POST' }
        );
        return 'unexpected-success';
      } catch {
        return 'blocked';
      }
    });
    expect(result).toBe('blocked');
    expect(() => firewall!.assertNoAttempts()).toThrow(
      'blocked 1 unexpected generation start'
    );
  } finally {
    await firewall?.stop();
    await context.close();
  }
});

test('secondary and read-only contexts independently block generation starts', async ({
  browser
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext()
  ]);
  const scopes = [
    'stale secondary-session firewall',
    'restored-runtime read-only firewall'
  ];
  const blockers = await Promise.all(
    contexts.map((context, index) =>
      installGenerationStartBlocker(context, scopes[index])
    )
  );
  try {
    for (let index = 0; index < contexts.length; index += 1) {
      const page = await contexts[index].newPage();
      await page.setContent(`<main>${scopes[index]} probe</main>`);
      const result = await page.evaluate(async () => {
        try {
          await fetch(
            'http://127.0.0.1:3000/api/v1/document-generation/saved-jobs/probe/operations',
            { method: 'POST' }
          );
          return 'unexpected-success';
        } catch {
          return 'blocked';
        }
      });
      expect(result).toBe('blocked');
      expect(() => blockers[index].assertNoAttempts()).toThrow(
        `The ${scopes[index]} blocked 1 unexpected generation start request(s).`
      );
    }
  } finally {
    await Promise.all(blockers.map(blocker => blocker.stop()));
    await Promise.all(contexts.map(context => context.close()));
  }
});

test('every unhooked stabilisation context installs and asserts its blocker', async () => {
  const [stalePage, restoredRunner] = await Promise.all([
    fs.readFile(path.resolve(__dirname, '../pages/StabilisationPage.ts'), 'utf8'),
    fs.readFile(
      path.resolve(__dirname, '../scripts/run-restored-stabilisation-smoke.js'),
      'utf8'
    )
  ]);
  expect(stalePage).toMatch(
    /installGenerationStartBlocker\(\s*secondContext,[\s\S]+?generationStartBlocker\.assertNoAttempts\(\)[\s\S]+?generationStartBlocker\.stop\(\)[\s\S]+?secondContext\.close\(\)/
  );
  expect(restoredRunner).toMatch(
    /installGenerationStartBlocker\(\s*context,[\s\S]+?generationStartBlocker\.assertNoAttempts\(\)[\s\S]+?generationStartBlocker\.stop\(\)[\s\S]+?context\.close\(\)/
  );
});

test('DEMO_READY preservation is narrow and ordinary scenarios still reset', () => {
  const allowed = {
    enabled: true,
    profile: 'e2e' as const,
    liveProfile: 'stabilisation',
    allowAiGeneration: true
  };
  expect(validatePreservationConfiguration(allowed)).toBe(true);
  expect(shouldPreserveDemoReady({
    ...allowed,
    state: 'DEMO_READY',
    tags: ['@e2e', '@stabilisation', '@stabilisation-live'],
    scenarioPassed: true,
    teardownSucceeded: true
  })).toBe(true);
  expect(shouldPreserveDemoReady({
    ...allowed,
    state: 'DEMO_READY',
    tags: ['@e2e', '@stabilisation', '@stabilisation-stale'],
    scenarioPassed: true,
    teardownSucceeded: true
  })).toBe(false);
  expect(() => shouldPreserveDemoReady({
    ...allowed,
    state: 'LOGIN_SESSION',
    tags: ['@e2e', '@stabilisation', '@stabilisation-live'],
    scenarioPassed: true,
    teardownSucceeded: true
  })).toThrow('may preserve only DEMO_READY');
  expect(shouldPreserveDemoReady({
    ...allowed,
    state: 'DEMO_READY',
    tags: ['@e2e', '@stabilisation', '@stabilisation-live'],
    scenarioPassed: false,
    teardownSucceeded: true
  })).toBe(false);
  expect(shouldPreserveDemoReady({
    ...allowed,
    state: 'DEMO_READY',
    tags: ['@e2e', '@stabilisation', '@stabilisation-live'],
    scenarioPassed: true,
    teardownSucceeded: false
  })).toBe(false);
  expect(() => validatePreservationConfiguration({
    ...allowed,
    profile: 'smoke'
  })).toThrow('restricted to the live stabilisation checkpoint');
  expect(() => validatePreservationConfiguration({
    ...allowed,
    allowAiGeneration: false
  })).toThrow('ALLOW_AI_GENERATION=true');
});

test('restored-runtime smoke is local, explicit and manifest-bounded', () => {
  const environment = {
    E2E_BASE_URL: 'http://127.0.0.1:3000',
    ALLOW_RESTORED_PERSISTENCE_SMOKE: 'true',
    RESTORED_RUNTIME_CONFIRMED: 'true',
    STABILISATION_MANIFEST:
      'test-results/stabilisation/preserved-live-manifest.json'
  };
  expect(validateRestoredPersistenceSmoke(environment)).toEqual({
    baseUrl: 'http://127.0.0.1:3000',
    manifest: 'test-results/stabilisation/preserved-live-manifest.json',
    artifactDirectory: 'test-results/stabilisation'
  });
  expect(requirePersistenceManifest()).toBe(
    'test-results/stabilisation/preserved-live-manifest.json'
  );
  expect(() => requirePersistenceManifest('../manifest.json'))
    .toThrow('under test-results/stabilisation');
  expect(requireStabilisationArtifactDirectory()).toBe(
    'test-results/stabilisation'
  );
  expect(() => requireStabilisationArtifactDirectory('/tmp/evidence'))
    .toThrow('under test-results/stabilisation');
  expect(() => validateRestoredPersistenceSmoke({
    ...environment,
    ALLOW_RESTORED_PERSISTENCE_SMOKE: 'false'
  })).toThrow('explicitly authorised');
  expect(() => validateRestoredPersistenceSmoke({
    ...environment,
    RESTORED_RUNTIME_CONFIRMED: 'false'
  })).toThrow('exact locked runtime');
});

test('five-job persistence manifest is private, distinct and bounded', async () => {
  const repository = await fs.mkdtemp(path.join(os.tmpdir(), 'jsc-stabilisation-'));
  const artifacts = new StabilisationArtifacts(
    repository,
    'test-results/stabilisation',
    'synthetic-run'
  );
  const jobs = Array.from({ length: 5 }, (_, index) => ({
    canonicalJobId: `canonical-job-${index + 1}`,
    provider: 'REED',
    providerJobId: `reed-job-${index + 1}`,
    applicationId: `application-${index + 1}`,
    cvDocumentId: `cv-document-${index + 1}`,
    coverLetterDocumentId: `cover-letter-document-${index + 1}`,
    title: `Synthetic role ${index + 1}`,
    company: `Synthetic employer ${index + 1}`,
    role: index % 2 === 0 ? 'Software Engineer' : 'Software Developer',
    page: 2,
    requirementTerms: ['Java', 'Testing']
  }));
  try {
    const output = await artifacts.savePersistenceManifest(
      'test-results/stabilisation/preserved-live-manifest.json',
      jobs
    );
    const manifest = JSON.parse(await fs.readFile(output, 'utf8'));
    expect(manifest).toEqual({
      version: 2,
      runId: 'synthetic-run',
      jobs
    });
    expect((await fs.stat(output)).mode & 0o777).toBe(0o600);
    await expect(artifacts.savePersistenceManifest('../outside.json', jobs))
      .rejects.toThrow('must stay under test-results/stabilisation');
    await expect(artifacts.savePersistenceManifest(
      'test-results/stabilisation/duplicate.json',
      [jobs[0], jobs[0], jobs[2], jobs[3], jobs[4]]
    )).rejects.toThrow('must be distinct');
  } finally {
    await fs.rm(repository, { recursive: true, force: true });
  }
});

test('generated-document semantics enforce identity, evidence and structure', () => {
  const context = {
    jobTitle: 'Junior Software Engineer',
    company: 'Example Recruitment',
    projectTitle: 'Job Seeker Copilot',
    qualificationTitle: 'Bachelor of Music',
    jobRequirementTerms: ['Java', 'Angular']
  };
  const cv = `
Alex Taylor
Junior Software Engineer

Technical Profile
Evidence-grounded software engineer focused on reliable web applications and accessible delivery.

Projects
Job Seeker Copilot
Built a job-search application with Java, Angular and PostgreSQL.

Technical Skills
Java, Angular, TypeScript, PostgreSQL, Testing

Education and Qualifications
Bachelor of Music, Royal Birmingham Conservatoire, completed in 2020.
  `;
  const coverLetter = `
Alex Taylor

Application for Junior Software Engineer at Example Recruitment

Dear Hiring Manager,

I am applying for this role after building Job Seeker Copilot with Java and Angular.
My Bachelor of Music developed disciplined practice and collaboration that I can apply here.
The selected project evidence demonstrates testing and reliable delivery for job seekers.

Yours faithfully,
Alex Taylor
`;
  expect(() => validateGeneratedDocumentText(cv, 'cv', context)).not.toThrow();
  expect(() => validateGeneratedDocumentText(coverLetter, 'cover-letter', context))
    .not.toThrow();
  expect(() => validateGeneratedDocumentText(
    `${coverLetter}\nBachelor of Music`,
    'cover-letter',
    context
  )).toThrow('duplicated the selected Qualification');
  expect(() => validateGeneratedDocumentText(
    cv.replace(
      'Evidence-grounded software engineer',
      'AWS-certified engineer with 10 years of experience'
    ),
    'cv',
    context
  )).toThrow('unsupported quantified or credential claim');
  const footerOnlyProjectReference = `
Alex Taylor
Junior Software Engineer

Technical Profile
Java developer focused on reliable software and testing.

Projects
Community website
Built an accessible information service.

Education and Qualifications
Bachelor of Music, Royal Birmingham Conservatoire, completed in 2020.

Generated with Job Seeker Copilot
`;
  expect(() => validateGeneratedDocumentText(
    footerOnlyProjectReference,
    'cv',
    context
  )).toThrow('omitted the selected Project evidence');
  expect(() => validateGeneratedDocumentText(
    `
Alex Taylor
Application for Junior Software Engineer at Example Recruitment

Dear Hiring Manager,

I am applying for the Junior Software Engineer role and can contribute Java
and testing skills. My Bachelor of Music developed disciplined practice.

Yours faithfully,
Alex Taylor

Generated with Job Seeker Copilot
`,
    'cover-letter',
    context
  )).toThrow('omitted the selected Project evidence');
});
