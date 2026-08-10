import dotenv from 'dotenv';
import { assertRelativeArtifactPath, readProfile, validateSessionPolicy } from './config-policy';
import { validatePreservationConfiguration } from './stabilisation-preservation';
import { validateConfiguredLiveStabilisation } from './stabilisation-runtime-safety';

dotenv.config();

function readBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];

  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
}

function readNumber(name: string, defaultValue: number): number {
  const value = process.env[name];

  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function readAccountEmailMode(value: string | undefined): 'fixture' | 'local-ses' {
  const mode = value ?? 'fixture';
  if (mode !== 'fixture' && mode !== 'local-ses') {
    throw new Error(
      'ACCOUNT_EMAIL_E2E_MODE must be fixture or local-ses; hosted SES is forbidden in E2E.'
    );
  }
  return mode;
}

const profile = readProfile(process.env.E2E_PROFILE);
const demoMode = readBoolean('DEMO_MODE', profile === 'demo');
const useSavedSession = readBoolean('USE_SAVED_SESSION', false);
const saveDemoSession = readBoolean('SAVE_DEMO_SESSION', false);
const allowRealProviderE2e = readBoolean('ALLOW_REAL_PROVIDER_E2E', false);
const allowAiGeneration = readBoolean('ALLOW_AI_GENERATION', false);
const preserveDemoReadyAfterRun = readBoolean('PRESERVE_DEMO_READY_AFTER_RUN', false);
const liveStabilisationProfile = validateConfiguredLiveStabilisation(process.env);

validateSessionPolicy(profile, demoMode, useSavedSession, saveDemoSession);
validatePreservationConfiguration({
  enabled: preserveDemoReadyAfterRun,
  profile,
  liveProfile: process.env.LIVE_STABILISATION_PROFILE,
  allowAiGeneration
});

export const e2eConfig = {
  profile,
  baseUrl: process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:3100',
  headless: readBoolean('HEADLESS', profile !== 'demo'),
  slowMo: readNumber('SLOW_MO', 150),
  recordVideo: readBoolean('RECORD_VIDEO', profile === 'demo'),
  videoDir: process.env.VIDEO_DIR ?? 'videos',
  demoMode,
  demoRecording: readBoolean('DEMO_RECORDING', false),
  useSavedSession,
  saveDemoSession,
  storageState: assertRelativeArtifactPath('STORAGE_STATE', process.env.STORAGE_STATE ?? '.auth/alex-taylor-session.json', '.auth'),
  artifactDir: assertRelativeArtifactPath('ARTIFACT_DIR', process.env.ARTIFACT_DIR ?? 'test-results/failures', 'test-results'),
  capacityResultDir: assertRelativeArtifactPath(
    'CAPACITY_RESULT_DIR',
    process.env.CAPACITY_RESULT_DIR ?? 'test-results/capacity/workers',
    'test-results/capacity'
  ),
  capacityFixtureConfirmed: readBoolean('CAPACITY_FIXTURE_CONFIRMED', false),
  maxFailureArtifacts: readNumber('MAX_FAILURE_ARTIFACTS', 20),
  cleanupEnabled: readBoolean('E2E_CLEANUP_ENABLED', false),
  cleanupBaseUrl: process.env.E2E_CLEANUP_BASE_URL,
  cleanupToken: process.env.E2E_CLEANUP_TOKEN,
  systemDataUrl: process.env.SYSTEM_DATA_SERVICE_URL,
  systemDataKey: process.env.SYSTEM_DATA_INTERNAL_CALLER_KEY,
  authenticationFixtureUrl: process.env.AUTHENTICATION_FIXTURE_URL,
  accountEmailMode: readAccountEmailMode(process.env.ACCOUNT_EMAIL_E2E_MODE),
  localStackSesUrl: process.env.LOCALSTACK_SES_URL,
  environmentDataToken: process.env.ENVIRONMENT_DATA_TOKEN,
  systemDataTimeoutMs: readNumber('SYSTEM_DATA_TIMEOUT_MS', 10_000),
  demoDownloadDir: process.env.DEMO_DOWNLOAD_DIR ?? 'demo-recordings/final-polish/downloads',
  allowRealProviderE2e,
  allowAiGeneration,
  allowSingleGenerationProbe: readBoolean('ALLOW_SINGLE_GENERATION_PROBE', false),
  allowCancellationE2e: readBoolean('ALLOW_CANCELLATION_E2E', false),
  liveStabilisationProfile,
  preserveDemoReadyAfterRun,
  stabilisationManifest: assertRelativeArtifactPath(
    'STABILISATION_MANIFEST',
    process.env.STABILISATION_MANIFEST
      ?? 'test-results/stabilisation/preserved-live-manifest.json',
    'test-results/stabilisation'
  ),
  stabilisationArtifactDir: assertRelativeArtifactPath(
    'STABILISATION_ARTIFACT_DIR',
    process.env.STABILISATION_ARTIFACT_DIR ?? 'test-results/stabilisation',
    'test-results'
  ),
  typingDelayMs: readNumber('TYPING_DELAY_MS', 65),
  demoBufferMs: readNumber('DEMO_BUFFER_MS', 2000),
  demoScrollMs: readNumber('DEMO_SCROLL_MS', 650),
  videoName: process.env.VIDEO_NAME ?? 'registration-demo'
};

export type E2EConfig = typeof e2eConfig;
