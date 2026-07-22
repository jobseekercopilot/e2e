import dotenv from 'dotenv';
import { assertRelativeArtifactPath, readProfile, validateSessionPolicy } from './config-policy';

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

const profile = readProfile(process.env.E2E_PROFILE);
const demoMode = readBoolean('DEMO_MODE', profile === 'demo');
const useSavedSession = readBoolean('USE_SAVED_SESSION', false);
const saveDemoSession = readBoolean('SAVE_DEMO_SESSION', false);

validateSessionPolicy(profile, demoMode, useSavedSession, saveDemoSession);

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
  maxFailureArtifacts: readNumber('MAX_FAILURE_ARTIFACTS', 20),
  cleanupEnabled: readBoolean('E2E_CLEANUP_ENABLED', false),
  cleanupBaseUrl: process.env.E2E_CLEANUP_BASE_URL,
  cleanupToken: process.env.E2E_CLEANUP_TOKEN,
  demoDownloadDir: process.env.DEMO_DOWNLOAD_DIR ?? 'demo-recordings/final-polish/downloads',
  allowAiGeneration: readBoolean('ALLOW_AI_GENERATION', false),
  typingDelayMs: readNumber('TYPING_DELAY_MS', 65),
  demoBufferMs: readNumber('DEMO_BUFFER_MS', 2000),
  demoScrollMs: readNumber('DEMO_SCROLL_MS', 650),
  videoName: process.env.VIDEO_NAME ?? 'registration-demo'
};

export type E2EConfig = typeof e2eConfig;
