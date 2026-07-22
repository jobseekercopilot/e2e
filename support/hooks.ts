import { After, Before, setDefaultTimeout, Status } from '@cucumber/cucumber';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createContext, createPage, launchBrowser } from './browser';
import { e2eConfig } from './config';
import { demoCursor } from './demo-cursor';
import type { JobSeekerWorld } from './world';

setDefaultTimeout(120_000);

Before(async function (this: JobSeekerWorld) {
  this.browser = await launchBrowser();
  this.context = await createContext(this.browser);
  const page = await createPage(this.context);
  await demoCursor.install(page);
  this.initialisePages(page);
});

After(async function (this: JobSeekerWorld, scenario) {
  const video = this.page?.video();

  if (scenario.result?.status === Status.FAILED && this.page) {
    const screenshot = await this.page.screenshot({
      path: path.resolve(__dirname, '..', 'screenshots', `${scenario.pickle.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`),
      fullPage: true
    });

    await this.attach(screenshot, 'image/png');
  }

  await this.page?.waitForTimeout(e2eConfig.demoBufferMs);
  if (this.page) {
    await demoCursor.remove(this.page);
  }

  if (this.context && scenario.result?.status === Status.PASSED) {
    const storageStatePath = path.resolve(__dirname, '..', e2eConfig.storageState);
    await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
    await this.context.storageState({ path: storageStatePath });
  }

  await this.context?.close();

  if (video) {
    const generatedVideoPath = await video.path();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const videoName = `${e2eConfig.videoName}-${timestamp}.webm`;
    const targetVideoPath = path.resolve(__dirname, '..', e2eConfig.videoDir, videoName);

    await fs.rename(generatedVideoPath, targetVideoPath);
  }

  await this.browser?.close();
});
