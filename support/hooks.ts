import { After, Before, setDefaultTimeout, Status } from '@cucumber/cucumber';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createContext, createPage, launchBrowser } from './browser';
import { e2eConfig } from './config';
import { demoCursor } from './demo-cursor';
import { pruneArtifacts, safeArtifactStem, writeFailureReport } from './artifacts';
import { cleanupSyntheticUser } from './cleanup';
import type { JobSeekerWorld } from './world';

setDefaultTimeout(120_000);

Before(async function (this: JobSeekerWorld, scenario) {
  if (scenario.pickle.tags.some(tag => tag.name === '@framework')) {
    return;
  }
  this.browser = await launchBrowser();
  this.context = await createContext(this.browser);
  if (e2eConfig.profile !== 'demo') {
    await this.context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    this.tracingStarted = true;
  }
  const page = await createPage(this.context);
  if (e2eConfig.profile === 'demo') await demoCursor.install(page);
  this.initialisePages(page);
});

After(async function (this: JobSeekerWorld, scenario) {
  if (scenario.pickle.tags.some(tag => tag.name === '@framework')) {
    return;
  }
  const video = this.page?.video();
  const failed = scenario.result?.status === Status.FAILED;
  const artifactDirectory = path.resolve(__dirname, '..', e2eConfig.artifactDir);
  const artifactStem = safeArtifactStem(scenario.pickle.name);

  if (failed && this.page && e2eConfig.profile !== 'demo') {
    await fs.mkdir(artifactDirectory, { recursive: true });
    const screenshot = await this.page.screenshot({
      path: path.join(artifactDirectory, `${artifactStem}.png`),
      fullPage: true
    });

    await this.attach(screenshot, 'image/png');
    await writeFailureReport(artifactDirectory, artifactStem, e2eConfig.profile);
  }

  if (e2eConfig.profile === 'demo') await this.page?.waitForTimeout(e2eConfig.demoBufferMs);
  if (this.page && e2eConfig.profile === 'demo') {
    await demoCursor.remove(this.page);
  }

  if (this.context && e2eConfig.profile === 'demo' && e2eConfig.saveDemoSession && scenario.result?.status === Status.PASSED) {
    const storageStatePath = path.resolve(__dirname, '..', e2eConfig.storageState);
    await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
    await this.context.storageState({ path: storageStatePath });
  }

  if (this.context && this.tracingStarted) {
    await this.context.tracing.stop(failed ? { path: path.join(artifactDirectory, `${artifactStem}.zip`) } : undefined);
    this.tracingStarted = false;
    if (failed) await pruneArtifacts(artifactDirectory, e2eConfig.maxFailureArtifacts);
  }

  await this.context?.close();

  if (video) {
    const generatedVideoPath = await video.path();
    const videoName = `${safeArtifactStem(e2eConfig.videoName)}.webm`;
    const targetVideoPath = path.resolve(__dirname, '..', e2eConfig.videoDir, videoName);

    await fs.mkdir(path.dirname(targetVideoPath), { recursive: true });
    await fs.rename(generatedVideoPath, targetVideoPath);
  }

  await this.browser?.close();

  for (const email of this.syntheticUsers) {
    await cleanupSyntheticUser(email, {
      enabled: e2eConfig.cleanupEnabled,
      baseUrl: e2eConfig.cleanupBaseUrl,
      token: e2eConfig.cleanupToken,
      profile: e2eConfig.profile
    });
  }
});
