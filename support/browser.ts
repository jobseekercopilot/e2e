import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { e2eConfig } from './config';

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: e2eConfig.headless,
    slowMo: e2eConfig.demoRecording ? 0 : e2eConfig.slowMo
  });
}

export async function createContext(browser: Browser): Promise<BrowserContext> {
  const storageStatePath = path.resolve(__dirname, '..', e2eConfig.storageState);

  return browser.newContext({
    baseURL: e2eConfig.baseUrl,
    viewport: { width: 1920, height: 1080 },
    storageState: e2eConfig.useSavedSession && fs.existsSync(storageStatePath)
      ? storageStatePath
      : undefined,
    recordVideo: e2eConfig.recordVideo
      ? {
          dir: path.resolve(__dirname, '..', e2eConfig.videoDir),
          size: { width: 1920, height: 1080 }
        }
      : undefined
  });
}

export async function createPage(context: BrowserContext): Promise<Page> {
  return context.newPage();
}
