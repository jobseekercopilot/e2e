import type { ExecutionProfile } from './config-policy';

export const NAMED_STATES = [
  'EMPTY',
  'REGISTRATION_CLEAN',
  'LOGIN_SESSION',
  'PROFILE_LOCATION',
  'DUPLICATE_REGISTRATION',
  'CROSS_USER_SECURITY',
  'REAL_WORLD_PERSONAS',
  'PROVIDER_FAILURE',
  'PAYMENT_ACCEPTANCE',
  'DEMO_READY'
] as const;

export type NamedState = typeof NAMED_STATES[number];

export interface NamedStateDefinition {
  scenarioId: string;
  version: string;
  scenario: NamedState;
  purpose: string;
  providerBehaviour: string;
  datasetId: string | null;
  datasetVersion: string | null;
  referenceDate: string;
  identities: Array<{
    key: string;
    email: string;
    displayName: string;
    resetComponents: string[];
    seedComponents: string[];
  }>;
  expected: Record<string, unknown>;
}

export interface EnvironmentOperationResponse {
  operationId: string;
  scenario: NamedState;
  status: 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt: string;
  services: Array<{
    service: string;
    operation: string;
    status: string;
    recordsAffected: number;
    details: Record<string, unknown>;
    warnings: string[];
  }>;
  summary: Record<string, unknown>;
  warnings: string[];
}

export interface SystemDataLifecycleConfig {
  baseUrl: string;
  key: string;
  runId: string;
  timeoutMs: number;
}

export interface FixturePaymentEventResponse {
  providerEventId: string;
  orderId: string;
  providerSessionId: string;
  event: 'COMPLETED' | 'EXPIRED';
  checkoutStatus: 'COMPLETE' | 'EXPIRED';
  paymentStatus: 'PAID' | 'UNPAID';
}

interface LifecycleEnvironment {
  systemDataUrl?: string;
  systemDataKey?: string;
  systemDataTimeoutMs: number;
  profile: ExecutionProfile;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const LOOPBACK_PORTS = new Set(['8103', '9103']);

function validateBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SYSTEM_DATA_SERVICE_URL must be a valid bounded test-stack URL.');
  }
  const clean = url.protocol === 'http:'
    && !url.username
    && !url.password
    && !url.search
    && !url.hash
    && (url.pathname === '/' || url.pathname === '');
  const loopback = LOOPBACK_HOSTS.has(url.hostname) && LOOPBACK_PORTS.has(url.port);
  const compose = url.hostname === 'system-data-service' && url.port === '8103';
  if (!clean || (!loopback && !compose)) {
    throw new Error('SYSTEM_DATA_SERVICE_URL must target HTTP loopback on port 8103/9103 or system-data-service:8103.');
  }
  return url.origin;
}

function validateCallerKey(value: string): void {
  if (value.length < 32 || value.trim() !== value || /\s/.test(value)) {
    throw new Error('SYSTEM_DATA_INTERNAL_CALLER_KEY must contain at least 32 characters.');
  }
}

function validateTimeout(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 30_000) {
    throw new Error('SYSTEM_DATA_TIMEOUT_MS must be an integer from 1000 to 30000.');
  }
}

export function parseNamedStateTag(tags: string[]): NamedState | undefined {
  const stateTags = tags.filter(tag => tag.startsWith('@state:'));
  if (stateTags.length === 0) return undefined;
  if (stateTags.length !== 1) throw new Error('A scenario must declare exactly one @state:<NAME> tag.');
  const state = stateTags[0].slice('@state:'.length).toUpperCase();
  if (!NAMED_STATES.includes(state as NamedState)) {
    throw new Error('Scenario declares an unsupported named state.');
  }
  return state as NamedState;
}

export function requireLifecycleConfig(
  environment: LifecycleEnvironment,
  state: NamedState,
  runId: string
): SystemDataLifecycleConfig {
  if (!environment.systemDataUrl || !environment.systemDataKey) {
    throw new Error('Stateful beta scenarios require SYSTEM_DATA_SERVICE_URL and SYSTEM_DATA_INTERNAL_CALLER_KEY.');
  }
  validateCallerKey(environment.systemDataKey);
  validateTimeout(environment.systemDataTimeoutMs);
  if (environment.profile === 'provider-failure' && state !== 'PROVIDER_FAILURE') {
    throw new Error('Provider-failure scenarios must request the PROVIDER_FAILURE named state.');
  }
  if (environment.profile !== 'provider-failure' && state === 'PROVIDER_FAILURE') {
    throw new Error('PROVIDER_FAILURE is restricted to the provider-failure profile.');
  }
  if (environment.profile === 'demo'
    && state !== 'DEMO_READY'
    && state !== 'REGISTRATION_CLEAN') {
    throw new Error('Demo lifecycle automation may request only DEMO_READY or REGISTRATION_CLEAN.');
  }
  if (!['demo', 'e2e'].includes(environment.profile) && state === 'DEMO_READY') {
    throw new Error('DEMO_READY is restricted to the demo and e2e profiles.');
  }
  if (environment.profile !== 'e2e' && state === 'PAYMENT_ACCEPTANCE') {
    throw new Error('PAYMENT_ACCEPTANCE is restricted to the e2e profile.');
  }
  return {
    baseUrl: validateBaseUrl(environment.systemDataUrl),
    key: environment.systemDataKey,
    runId,
    timeoutMs: environment.systemDataTimeoutMs
  };
}

export class SystemDataClient {
  constructor(
    private readonly config: SystemDataLifecycleConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.config.baseUrl = validateBaseUrl(this.config.baseUrl);
    validateCallerKey(this.config.key);
    validateTimeout(this.config.timeoutMs);
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(this.config.runId)) {
      throw new Error('System-data run ID must be a non-sensitive alphanumeric identifier.');
    }
  }

  listStates(): Promise<NamedStateDefinition[]> {
    return this.request('list states', '/internal/environments/states', undefined, isNamedStateList);
  }

  describe(state: NamedState): Promise<NamedStateDefinition> {
    return this.request('describe state', `/internal/environments/states/${encodeURIComponent(state)}`, undefined,
      (value): value is NamedStateDefinition => isNamedStateDefinition(value) && value.scenario === state);
  }

  prepare(state: NamedState): Promise<EnvironmentOperationResponse> {
    return this.operation('prepare', '/internal/environments/prepare', state);
  }

  verify(state: NamedState): Promise<EnvironmentOperationResponse> {
    return this.request('verify', `/internal/environments/verify?scenario=${encodeURIComponent(state)}`, undefined,
      value => isSuccessfulOperation(value, state));
  }

  reset(state: NamedState): Promise<EnvironmentOperationResponse> {
    return this.operation('reset', '/internal/environments/reset', state);
  }

  paymentEvent(
    providerSessionId: string,
    event: 'COMPLETED' | 'EXPIRED'
  ): Promise<FixturePaymentEventResponse> {
    if (!/^cs_fixture_[a-f0-9]{32}$/.test(providerSessionId)) {
      throw new Error('Fixture payment session ID is invalid.');
    }
    return this.request(
      'payment event',
      `/internal/environments/payment-fixtures/checkout-sessions/${providerSessionId}/events`,
      {method: 'POST', body: JSON.stringify({event})},
      value => isFixturePaymentEvent(value, providerSessionId, event)
    );
  }

  private operation(operation: string, path: string, state: NamedState): Promise<EnvironmentOperationResponse> {
    return this.request(operation, path, {
      method: 'POST',
      body: JSON.stringify({ scenario: state })
    }, value => isSuccessfulOperation(value, state));
  }

  private async request<T>(
    operation: string,
    requestPath: string,
    init: RequestInit | undefined,
    validate: (value: unknown) => value is T
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(new URL(requestPath, this.config.baseUrl), {
        ...init,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          'X-System-Data-Key': this.config.key,
          'X-E2E-Run-Id': this.config.runId
        }
      });
      if (!response.ok) {
        throw new Error(`System-data ${operation} failed with HTTP ${response.status}.`);
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error(`System-data ${operation} returned invalid JSON.`);
      }
      if (!validate(body)) {
        throw new Error(`System-data ${operation} returned an invalid contract response.`);
      }
      return body;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`System-data ${operation} timed out.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function prepareNamedState(client: SystemDataClient, state: NamedState): Promise<NamedStateDefinition> {
  try {
    const definition = await client.describe(state);
    await client.prepare(state);
    await client.verify(state);
    return definition;
  } catch (originalError) {
    try { await client.reset(state); } catch { /* preserve the preparation failure */ }
    throw originalError;
  }
}

export async function resetNamedState(
  client: SystemDataClient,
  state: NamedState,
  scenarioAlreadyFailed: boolean,
  onSuppressedFailure: () => Promise<void>
): Promise<void> {
  try {
    await client.reset(state);
  } catch (cleanupError) {
    if (!scenarioAlreadyFailed) throw cleanupError;
    await onSuppressedFailure();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNamedStateDefinition(value: unknown): value is NamedStateDefinition {
  return isRecord(value)
    && typeof value.scenarioId === 'string'
    && typeof value.version === 'string'
    && NAMED_STATES.includes(value.scenario as NamedState)
    && typeof value.purpose === 'string'
    && typeof value.providerBehaviour === 'string'
    && (value.datasetId === null || typeof value.datasetId === 'string')
    && (value.datasetVersion === null || typeof value.datasetVersion === 'string')
    && typeof value.referenceDate === 'string'
    && Array.isArray(value.identities)
    && value.identities.every(identity => isRecord(identity)
      && typeof identity.key === 'string'
      && typeof identity.email === 'string'
      && typeof identity.displayName === 'string'
      && isStringArray(identity.resetComponents)
      && isStringArray(identity.seedComponents))
    && isRecord(value.expected);
}

function isNamedStateList(value: unknown): value is NamedStateDefinition[] {
  return Array.isArray(value) && value.every(isNamedStateDefinition);
}

function isSuccessfulOperation(value: unknown, state: NamedState): value is EnvironmentOperationResponse {
  return isRecord(value)
    && typeof value.operationId === 'string'
    && value.scenario === state
    && value.status === 'SUCCESS'
    && typeof value.startedAt === 'string'
    && typeof value.completedAt === 'string'
    && Array.isArray(value.services)
    && value.services.every(service => isRecord(service)
      && typeof service.service === 'string'
      && typeof service.operation === 'string'
      && typeof service.status === 'string'
      && typeof service.recordsAffected === 'number'
      && isRecord(service.details)
      && isStringArray(service.warnings))
    && isRecord(value.summary)
    && isStringArray(value.warnings);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isFixturePaymentEvent(
  value: unknown,
  providerSessionId: string,
  event: 'COMPLETED' | 'EXPIRED'
): value is FixturePaymentEventResponse {
  return isRecord(value)
    && typeof value.providerEventId === 'string'
    && /^[A-Za-z0-9_:-]{20,255}$/.test(value.providerEventId)
    && typeof value.orderId === 'string'
    && /^[0-9a-f-]{36}$/.test(value.orderId)
    && value.providerSessionId === providerSessionId
    && value.event === event
    && value.checkoutStatus === (event === 'COMPLETED' ? 'COMPLETE' : 'EXPIRED')
    && value.paymentStatus === (event === 'COMPLETED' ? 'PAID' : 'UNPAID');
}
