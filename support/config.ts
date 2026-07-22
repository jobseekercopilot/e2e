import dotenv from 'dotenv';

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

export const e2eConfig = {
  baseUrl: process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:3100',
  headless: readBoolean('HEADLESS', false),
  slowMo: readNumber('SLOW_MO', 150),
  recordVideo: readBoolean('RECORD_VIDEO', true),
  videoDir: process.env.VIDEO_DIR ?? 'videos',
  demoMode: readBoolean('DEMO_MODE', true),
  demoRecording: readBoolean('DEMO_RECORDING', false),
  useSavedSession: readBoolean('USE_SAVED_SESSION', false),
  storageState: process.env.STORAGE_STATE ?? '.auth/alex-taylor-session.json',
  demoDownloadDir: process.env.DEMO_DOWNLOAD_DIR ?? 'demo-recordings/final-polish/downloads',
  allowAiGeneration: readBoolean('ALLOW_AI_GENERATION', false),
  typingDelayMs: readNumber('TYPING_DELAY_MS', 65),
  demoBufferMs: readNumber('DEMO_BUFFER_MS', 2000),
  demoScrollMs: readNumber('DEMO_SCROLL_MS', 650),
  videoName: process.env.VIDEO_NAME ?? 'registration-demo'
};

export type E2EConfig = typeof e2eConfig;
