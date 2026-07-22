import { expect, test } from '@playwright/test';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import {
  parseNamedStateTag,
  prepareNamedState,
  requireLifecycleConfig,
  resetNamedState,
  SystemDataClient,
  type EnvironmentOperationResponse,
  type NamedState,
  type NamedStateDefinition
} from '../support/system-data';

const TEST_KEY = 'synthetic-system-data-key-32-chars';

function definition(state: NamedState): NamedStateDefinition {
  return {
    scenarioId: `${state.toLowerCase().replaceAll('_', '-')}-v1`,
    version: '1.0.0',
    scenario: state,
    purpose: 'Synthetic contract test',
    providerBehaviour: state === 'PROVIDER_FAILURE' ? 'ALL_PROVIDERS_FAIL' : 'FIXTURE',
    datasetId: null,
    datasetVersion: null,
    referenceDate: '2026-07-22T00:00:00Z',
    identities: [],
    expected: {}
  };
}

function operation(state: NamedState, operationName: string): EnvironmentOperationResponse {
  return {
    operationId: `${operationName}-operation`,
    scenario: state,
    status: 'SUCCESS',
    startedAt: '2026-07-22T00:00:00Z',
    completedAt: '2026-07-22T00:00:01Z',
    services: [],
    summary: {},
    warnings: []
  };
}

async function localServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(9103, '127.0.0.1', resolve);
  });
  return {
    baseUrl: 'http://127.0.0.1:9103',
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
}

function client(baseUrl: string, key = TEST_KEY): SystemDataClient {
  return new SystemDataClient({ baseUrl, key, runId: 'contract-run-1', timeoutMs: 2_000 });
}

async function captureError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error('Expected an Error instance.');
  }
  throw new Error('Expected promise to reject.');
}

test('client matches the system-data list, describe, prepare, verify and reset contract', async () => {
  const requests: Array<{ method?: string; url?: string; key?: string; runId?: string; body: string }> = [];
  const server = await localServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk.toString(); });
    request.on('end', () => {
      requests.push({
        method: request.method,
        url: request.url,
        key: request.headers['x-system-data-key']?.toString(),
        runId: request.headers['x-e2e-run-id']?.toString(),
        body
      });
      response.setHeader('content-type', 'application/json');
      if (request.url === '/internal/environments/states') response.end(JSON.stringify([definition('PROFILE_LOCATION')]));
      else if (request.url?.startsWith('/internal/environments/states/')) response.end(JSON.stringify(definition('PROFILE_LOCATION')));
      else if (request.url?.startsWith('/internal/environments/verify')) response.end(JSON.stringify(operation('PROFILE_LOCATION', 'verify')));
      else if (request.url === '/internal/environments/prepare') response.end(JSON.stringify(operation('PROFILE_LOCATION', 'prepare')));
      else if (request.url === '/internal/environments/reset') response.end(JSON.stringify(operation('PROFILE_LOCATION', 'reset')));
      else { response.statusCode = 404; response.end('{}'); }
    });
  });

  try {
    const systemData = client(server.baseUrl);
    expect(await systemData.listStates()).toHaveLength(1);
    expect((await systemData.describe('PROFILE_LOCATION')).scenarioId).toBe('profile-location-v1');
    await systemData.prepare('PROFILE_LOCATION');
    await systemData.verify('PROFILE_LOCATION');
    await systemData.reset('PROFILE_LOCATION');

    expect(requests.map(request => `${request.method} ${request.url}`)).toEqual([
      'GET /internal/environments/states',
      'GET /internal/environments/states/PROFILE_LOCATION',
      'POST /internal/environments/prepare',
      'GET /internal/environments/verify?scenario=PROFILE_LOCATION',
      'POST /internal/environments/reset'
    ]);
    expect(requests.every(request => request.key === TEST_KEY && request.runId === 'contract-run-1')).toBe(true);
    expect(requests.filter(request => request.method === 'POST').map(request => request.body))
      .toEqual([JSON.stringify({ scenario: 'PROFILE_LOCATION' }), JSON.stringify({ scenario: 'PROFILE_LOCATION' })]);
  } finally {
    await server.close();
  }
});

test('state tags and profile selection fail closed', () => {
  expect(parseNamedStateTag(['@e2e', '@state:profile_location'])).toBe('PROFILE_LOCATION');
  expect(parseNamedStateTag(['@e2e'])).toBeUndefined();
  expect(() => parseNamedStateTag(['@state:EMPTY', '@state:LOGIN_SESSION'])).toThrow('exactly one');
  expect(() => parseNamedStateTag(['@state:NOT_REAL'])).toThrow('unsupported');

  const base = { systemDataUrl: 'http://localhost:9103', systemDataKey: TEST_KEY, systemDataTimeoutMs: 10_000 };
  expect(requireLifecycleConfig({ ...base, profile: 'provider-failure' }, 'PROVIDER_FAILURE', 'run').baseUrl)
    .toBe('http://localhost:9103');
  expect(requireLifecycleConfig({ ...base, systemDataUrl: 'http://system-data-service:8103', profile: 'e2e' }, 'EMPTY', 'run').baseUrl)
    .toBe('http://system-data-service:8103');
  expect(() => requireLifecycleConfig({ ...base, profile: 'provider-failure' }, 'EMPTY', 'run'))
    .toThrow('must request the PROVIDER_FAILURE');
  expect(() => requireLifecycleConfig({ ...base, profile: 'security' }, 'PROVIDER_FAILURE', 'run'))
    .toThrow('restricted to the provider-failure profile');
  expect(() => requireLifecycleConfig({ ...base, profile: 'demo' }, 'EMPTY', 'run'))
    .toThrow('only the DEMO_READY');
  expect(() => requireLifecycleConfig({ ...base, profile: 'e2e' }, 'DEMO_READY', 'run'))
    .toThrow('restricted to the demo profile');
});

test('lifecycle configuration rejects missing secrets and unsafe targets without echoing them', () => {
  const candidates = [
    'https://localhost:9103',
    'http://system-data-service:9103',
    'http://127.0.0.1:8080',
    'http://10.0.0.2:8103',
    'http://user:password@localhost:9103',
    'http://localhost:9103/internal'
  ];
  for (const systemDataUrl of candidates) {
    expect(() => requireLifecycleConfig({
      systemDataUrl,
      systemDataKey: TEST_KEY,
      systemDataTimeoutMs: 10_000,
      profile: 'e2e'
    }, 'EMPTY', 'run')).toThrow(/SYSTEM_DATA_SERVICE_URL/);
  }
  expect(() => requireLifecycleConfig({ profile: 'e2e', systemDataTimeoutMs: 10_000 }, 'EMPTY', 'run'))
    .toThrow('require SYSTEM_DATA_SERVICE_URL and SYSTEM_DATA_INTERNAL_CALLER_KEY');
  expect(() => requireLifecycleConfig({
    systemDataUrl: 'http://localhost:9103', systemDataKey: 'too-short', systemDataTimeoutMs: 10_000, profile: 'e2e'
  }, 'EMPTY', 'run')).toThrow('at least 32 characters');
  expect(() => requireLifecycleConfig({
    systemDataUrl: 'http://localhost:9103', systemDataKey: `${TEST_KEY} `, systemDataTimeoutMs: 10_000, profile: 'e2e'
  }, 'EMPTY', 'run')).toThrow('at least 32 characters');
  expect(() => requireLifecycleConfig({
    systemDataUrl: 'http://localhost:9103', systemDataKey: TEST_KEY, systemDataTimeoutMs: 999, profile: 'e2e'
  }, 'EMPTY', 'run')).toThrow('1000 to 30000');
});

test('HTTP and contract failures redact the key, URL and response body', async () => {
  const secretBody = `do-not-expose ${TEST_KEY}`;
  const server = await localServer((_request, response) => {
    response.statusCode = 401;
    response.end(secretBody);
  });
  try {
    const error = await captureError(client(server.baseUrl).prepare('EMPTY'));
    expect(error.message).toBe('System-data prepare failed with HTTP 401.');
    expect(error.message).not.toContain(TEST_KEY);
    expect(error.message).not.toContain(server.baseUrl);
    expect(error.message).not.toContain(secretBody);
  } finally {
    await server.close();
  }
});

test('prepare failure attempts reset but preserves the original error', async () => {
  const paths: string[] = [];
  const server = await localServer((request, response) => {
    paths.push(request.url ?? '');
    response.statusCode = request.url === '/internal/environments/reset' ? 503 : 500;
    response.end('{}');
  });
  try {
    const error = await captureError(prepareNamedState(client(server.baseUrl), 'LOGIN_SESSION'));
    expect(error.message).toBe('System-data describe state failed with HTTP 500.');
    expect(paths).toEqual(['/internal/environments/states/LOGIN_SESSION', '/internal/environments/reset']);
  } finally {
    await server.close();
  }
});

test('failed-scenario reset failure is reported without masking the original failure', async () => {
  const server = await localServer((_request, response) => {
    response.statusCode = 503;
    response.end('{}');
  });
  try {
    let suppressed = false;
    await expect(resetNamedState(client(server.baseUrl), 'EMPTY', true, async () => { suppressed = true; }))
      .resolves.toBeUndefined();
    expect(suppressed).toBe(true);
    await expect(resetNamedState(client(server.baseUrl), 'EMPTY', false, async () => undefined))
      .rejects.toThrow('System-data reset failed with HTTP 503.');
  } finally {
    await server.close();
  }
});

test('invalid success bodies and wrong named states are rejected', async () => {
  const server = await localServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(request.url?.startsWith('/internal/environments/states/')
      ? JSON.stringify(definition('EMPTY'))
      : JSON.stringify({ status: 'SUCCESS' }));
  });
  try {
    await expect(client(server.baseUrl).describe('LOGIN_SESSION')).rejects.toThrow('invalid contract response');
    await expect(client(server.baseUrl).prepare('EMPTY')).rejects.toThrow('invalid contract response');
  } finally {
    await server.close();
  }
});
