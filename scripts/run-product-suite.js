#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const suite = process.argv[2];
if (!['critical', 'regression'].includes(suite)) {
  throw new Error('Choose critical or regression.');
}
const root = path.resolve(__dirname, '..');
const cucumber = path.join(root, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js');

function safeFixtureUrl(environment) {
  const url = new URL(environment.E2E_BASE_URL || environment.BASE_URL || 'http://localhost:3100');
  const safe = url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    && url.port === '3100'
    && (url.pathname === '/' || url.pathname === '')
    && !url.username && !url.password && !url.search && !url.hash;
  if (!safe) throw new Error('Product-confidence suites are restricted to the isolated fixture frontend on port 3100.');
  if (environment.ALLOW_REAL_PROVIDER_E2E === 'true' || environment.ALLOW_AI_GENERATION === 'true') {
    throw new Error('Product-confidence suites refuse real providers and paid AI generation.');
  }
  return url.origin;
}

const baseUrl = safeFixtureUrl(process.env);
const commonEnvironment = {
  ...process.env,
  E2E_BASE_URL: baseUrl,
  BASE_URL: baseUrl,
  DEMO_MODE: 'false',
  USE_SAVED_SESSION: 'false',
  SAVE_DEMO_SESSION: 'false',
  HEADLESS: process.env.HEADLESS || 'true',
  RECORD_VIDEO: 'false',
  ALLOW_REAL_PROVIDER_E2E: 'false',
  ALLOW_AI_GENERATION: 'false'
};
const runs = suite === 'critical'
  ? [
      { profile: 'smoke', e2eProfile: 'smoke', tags: '@critical-smoke' },
      { profile: 'e2e', e2eProfile: 'e2e', tags: '@critical-smoke' }
    ]
  : [
      { profile: 'smoke', e2eProfile: 'smoke', tags: '@stack' },
      { profile: 'e2e', e2eProfile: 'e2e', tags: 'not @stabilisation' },
      { profile: 'security', e2eProfile: 'security', tags: '@security' },
      { profile: 'providerFailure', e2eProfile: 'provider-failure', tags: '@provider-failure' },
      { profile: 'accessibility', e2eProfile: 'accessibility', tags: '@accessibility and not @framework' }
    ];

for (const run of runs) {
  process.stdout.write(`\nRunning ${suite}: profile=${run.profile}, tags=${run.tags}\n`);
  const result = spawnSync(process.execPath, [
    cucumber,
    '--profile', run.profile,
    '--tags', run.tags
  ], {
    cwd: root,
    env: { ...commonEnvironment, E2E_PROFILE: run.e2eProfile },
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
