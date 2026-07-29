import type { BrowserContext, Route } from '@playwright/test';

type LiveMode = 'checkpoint' | 'ui' | 'stale' | 'probe' | 'cancellation';
type LiveProfile =
  | 'stabilisation'
  | 'stabilisationUi'
  | 'stabilisationStale'
  | 'stabilisationProbe'
  | 'stabilisationCancellation';

interface LivePolicy {
  profile: LiveProfile;
}

interface LivePolicyModule {
  validateLiveStabilisation(
    mode: LiveMode,
    environment: NodeJS.ProcessEnv
  ): LivePolicy;
}

const { validateLiveStabilisation } = require(
  '../scripts/live-stabilisation-policy'
) as LivePolicyModule;

const PROFILE_MODE: Record<LiveProfile, LiveMode> = {
  stabilisation: 'checkpoint',
  stabilisationUi: 'ui',
  stabilisationStale: 'stale',
  stabilisationProbe: 'probe',
  stabilisationCancellation: 'cancellation'
};

export interface ZeroCreditGenerationFirewall {
  assertNoAttempts(): void;
  stop(): Promise<void>;
}

export async function installGenerationStartBlocker(
  context: BrowserContext,
  scope: string
): Promise<ZeroCreditGenerationFirewall> {
  let blockedAttempts = 0;
  const pattern = '**/api/v1/document-generation/**';
  const handler = async (route: Route): Promise<void> => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (
      request.method() === 'POST'
      && /^\/api\/v1\/document-generation\/.+\/operations$/.test(pathname)
    ) {
      blockedAttempts += 1;
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  };

  await context.route(pattern, handler);
  let stopped = false;
  return {
    assertNoAttempts: () => {
      if (blockedAttempts !== 0) {
        throw new Error(
          `The ${scope} blocked ${blockedAttempts} unexpected generation start request(s).`
        );
      }
    },
    stop: async () => {
      if (stopped) return;
      stopped = true;
      await context.unroute(pattern, handler);
    }
  };
}

function readLiveProfile(value: string | undefined): LiveProfile | undefined {
  if (!value) return undefined;
  if (Object.prototype.hasOwnProperty.call(PROFILE_MODE, value)) {
    return value as LiveProfile;
  }
  throw new Error('LIVE_STABILISATION_PROFILE is not a recognised bounded profile.');
}

export function validateConfiguredLiveStabilisation(
  environment: NodeJS.ProcessEnv
): LiveProfile | undefined {
  const profile = readLiveProfile(environment.LIVE_STABILISATION_PROFILE);
  if (!profile) return undefined;
  const policy = validateLiveStabilisation(PROFILE_MODE[profile], environment);
  if (policy.profile !== profile) {
    throw new Error('The configured live stabilisation profile did not match its safety policy.');
  }
  return profile;
}

function requiredScenarioProfile(tags: string[]): LiveProfile {
  const scenarioProfiles = [
    ['@stabilisation-ui', 'stabilisationUi'],
    ['@stabilisation-stale', 'stabilisationStale'],
    ['@stabilisation-probe', 'stabilisationProbe'],
    ['@stabilisation-live', 'stabilisation'],
    ['@stabilisation-cancellation', 'stabilisationCancellation']
  ] as const;
  const matches = scenarioProfiles.filter(([tag]) => tags.includes(tag));
  if (matches.length !== 1) {
    throw new Error(
      'A stabilisation scenario must declare exactly one bounded stabilisation mode tag.'
    );
  }
  return matches[0][1];
}

export function enforceStabilisationScenarioSafety(
  tags: string[],
  config: {
    profile: string;
    baseUrl: string;
    systemDataUrl?: string;
    systemDataKey?: string;
    allowRealProviderE2e: boolean;
    allowAiGeneration: boolean;
    allowSingleGenerationProbe: boolean;
    allowCancellationE2e: boolean;
    liveStabilisationProfile?: string;
  }
): void {
  if (!tags.includes('@stabilisation')) return;
  if (config.profile !== 'e2e') {
    throw new Error('Live stabilisation scenarios require the isolated e2e profile.');
  }
  if (!tags.includes('@state:DEMO_READY')) {
    throw new Error('Live stabilisation scenarios are restricted to @state:DEMO_READY.');
  }

  const configuredProfile = readLiveProfile(config.liveStabilisationProfile);
  if (!configuredProfile) {
    throw new Error(
      'Direct Cucumber execution is blocked. Use the bounded live stabilisation runner.'
    );
  }
  const scenarioProfile = requiredScenarioProfile(tags);
  if (
    configuredProfile === 'stabilisation'
    && scenarioProfile === 'stabilisationCancellation'
  ) {
    throw new Error(
      'The cancellation scenario requires its separately authorised bounded runner.'
    );
  }
  if (configuredProfile !== scenarioProfile) {
    throw new Error(
      `The ${configuredProfile} runner cannot execute a ${scenarioProfile} scenario.`
    );
  }

  const environment: NodeJS.ProcessEnv = {
    E2E_BASE_URL: config.baseUrl,
    SYSTEM_DATA_SERVICE_URL: config.systemDataUrl,
    SYSTEM_DATA_INTERNAL_CALLER_KEY: config.systemDataKey,
    ALLOW_REAL_PROVIDER_E2E: String(config.allowRealProviderE2e),
    ALLOW_AI_GENERATION: String(config.allowAiGeneration),
    ALLOW_SINGLE_GENERATION_PROBE: String(config.allowSingleGenerationProbe),
    ALLOW_CANCELLATION_E2E: String(config.allowCancellationE2e)
  };
  const policy = validateLiveStabilisation(
    PROFILE_MODE[configuredProfile],
    environment
  );
  if (policy.profile !== configuredProfile) {
    throw new Error('The scenario did not satisfy its live stabilisation safety policy.');
  }
}

export async function installZeroCreditGenerationFirewall(
  context: BrowserContext,
  tags: string[]
): Promise<ZeroCreditGenerationFirewall | undefined> {
  if (!tags.includes('@stabilisation')) return undefined;
  const scenarioProfile = requiredScenarioProfile(tags);
  if (!['stabilisationUi', 'stabilisationStale'].includes(scenarioProfile)) {
    return undefined;
  }

  return await installGenerationStartBlocker(
    context,
    'zero-credit stabilisation firewall'
  );
}
