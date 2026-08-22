#!/usr/bin/env node
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const cucumberBin = path.join(root, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js');

function parseArgs(argv) {
  const result = { users: 1, iterations: 1, output: 'test-results/capacity/workload.json' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--users') result.users = Number(argv[++index]);
    else if (argument === '--iterations') result.iterations = Number(argv[++index]);
    else if (argument === '--output') result.output = argv[++index];
    else throw new Error(`Unsupported argument: ${argument}`);
  }
  if (!Number.isSafeInteger(result.users) || result.users < 1 || result.users > 100) {
    throw new Error('--users must be an integer from 1 to 100.');
  }
  if (!Number.isSafeInteger(result.iterations) || result.iterations < 1 || result.iterations > 20) {
    throw new Error('--iterations must be an integer from 1 to 20.');
  }
  const output = path.resolve(root, result.output);
  const allowedRoot = path.resolve(root, 'test-results', 'capacity');
  if (output !== allowedRoot && !output.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error('--output must remain under test-results/capacity/.');
  }
  return { ...result, output };
}

function requireSafeFixtureEnvironment(environment) {
  if (environment.ALLOW_CAPACITY_E2E !== 'true' || environment.CAPACITY_FIXTURE_CONFIRMED !== 'true') {
    throw new Error('Capacity journeys require ALLOW_CAPACITY_E2E=true and CAPACITY_FIXTURE_CONFIRMED=true.');
  }
  const baseUrl = new URL(environment.E2E_BASE_URL || environment.BASE_URL || 'http://localhost:3100');
  const safe = baseUrl.protocol === 'http:'
    && ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)
    && baseUrl.port === '3100'
    && (baseUrl.pathname === '/' || baseUrl.pathname === '')
    && !baseUrl.username && !baseUrl.password && !baseUrl.search && !baseUrl.hash;
  if (!safe) throw new Error('Capacity journeys are restricted to the isolated fixture frontend on loopback port 3100.');
  if (environment.ALLOW_REAL_PROVIDER_E2E === 'true' || environment.ALLOW_AI_GENERATION === 'true') {
    throw new Error('Capacity journeys refuse real providers and paid AI generation.');
  }
  return baseUrl.origin;
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(percentileValue * sorted.length) - 1)];
}

function classifyError(sample, baseUrl) {
  const url = new URL(sample.url);
  if (url.origin !== baseUrl) return 'external-resource';
  if (sample.failure === 'net::ERR_ABORTED') return 'aborted';
  if (sample.status === 401 && [
    '/api/auth/profile',
    '/api/auth/refresh'
  ].includes(url.pathname)) return 'expected-auth-bootstrap';
  return 'application';
}

function runWorker(index, environment, resultDirectory) {
  const started = Date.now();
  return new Promise(resolve => {
    const child = spawn(process.execPath, [
      cucumberBin,
      'features/chapters/DISCOVER.feature',
      '--tags', '@capacity-workload',
      '--format', 'progress'
    ], {
      cwd: root,
      env: {
        ...environment,
        E2E_PROFILE: 'demo',
        DEMO_MODE: 'true',
        DEMO_RECORDING: 'false',
        HEADLESS: 'true',
        RECORD_VIDEO: 'false',
        USE_SAVED_SESSION: 'false',
        SAVE_DEMO_SESSION: 'false',
        SLOW_MO: '0',
        TYPING_DELAY_MS: '0',
        DEMO_BUFFER_MS: '0',
        DEMO_SCROLL_MS: '0',
        VIDEO_DIR: 'test-results/capacity/videos',
        CAPACITY_RESULT_DIR: path.relative(root, resultDirectory),
        CUCUMBER_WORKER_ID: `capacity-${index}`
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', chunk => { output = `${output}${chunk}`.slice(-4000); });
    child.stderr.on('data', chunk => { output = `${output}${chunk}`.slice(-4000); });
    child.on('close', (code, signal) => resolve({
      worker: index,
      exitCode: code,
      signal,
      durationMs: Date.now() - started,
      output: code === 0 ? undefined : output
    }));
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = requireSafeFixtureEnvironment(process.env);
  if (!fs.existsSync(cucumberBin)) throw new Error('Run npm ci before capacity workloads.');
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const resultDirectory = path.join(root, 'test-results', 'capacity', 'workers', runId);
  fs.mkdirSync(resultDirectory, { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.dirname(options.output), { recursive: true, mode: 0o700 });

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const results = [];
  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const batch = await Promise.all(Array.from(
      { length: options.users },
      (_, worker) => runWorker(iteration * options.users + worker, process.env, resultDirectory)
    ));
    results.push(...batch);
  }

  const scenarioReports = fs.readdirSync(resultDirectory)
    .filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(fs.readFileSync(path.join(resultDirectory, file), 'utf8')));
  const durations = results.map(result => result.durationMs);
  const responseDurations = scenarioReports.flatMap(report =>
    report.responses.map(response => response.durationMs).filter(Number.isFinite)
  );
  const classifiedErrors = scenarioReports.flatMap(report => report.errors)
    .reduce((counts, sample) => {
      const classification = classifyError(sample, baseUrl);
      counts[classification] += 1;
      return counts;
    }, {
      application: 0,
      'expected-auth-bootstrap': 0,
      'external-resource': 0,
      aborted: 0
    });
  const elapsedSeconds = (Date.now() - startedMs) / 1000;
  const failures = results.filter(result => result.exitCode !== 0);
  const report = {
    schemaVersion: 1,
    evidenceClass: 'measured',
    runId,
    profile: 'fixture-discover-browser-session',
    baseUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    concurrency: options.users,
    iterations: options.iterations,
    activeBrowserSessions: results.length,
    registeredFixtureUsers: 1,
    elapsedSeconds,
    throughputSessionsPerSecond: elapsedSeconds > 0 ? results.length / elapsedSeconds : null,
    successfulSessions: results.length - failures.length,
    failedSessions: failures.length,
    responseCount: scenarioReports.reduce((sum, report) => sum + report.responseCount, 0),
    responseErrors: scenarioReports.reduce((sum, report) => sum + report.errorCount, 0),
    applicationErrors: classifiedErrors.application,
    expectedAuthBootstrapResponses: classifiedErrors['expected-auth-bootstrap'],
    externalResourceErrors: classifiedErrors['external-resource'],
    abortedRequests: classifiedErrors.aborted,
    sessionLatencyMs: {
      p50: percentile(durations, 0.50),
      p95: percentile(durations, 0.95),
      p99: durations.length >= 100 ? percentile(durations, 0.99) : null
    },
    responseLatencyMs: {
      p50: percentile(responseDurations, 0.50),
      p95: percentile(responseDurations, 0.95),
      p99: responseDurations.length >= 100 ? percentile(responseDurations, 0.99) : null
    },
    workers: results,
    scenarioReports: scenarioReports.map(report => ({
      runId: report.runId,
      status: report.status,
      responseCount: report.responseCount,
      errorCount: report.errorCount,
      consoleErrorCount: report.consoleErrorCount
    }))
  };
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
