import { After, Before, setDefaultTimeout, Status } from '@cucumber/cucumber';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createContext, createPage, launchBrowser } from './browser';
import { e2eConfig } from './config';
import { clearAccountEmailCapture } from './account-email-capture';
import { demoCursor } from './demo-cursor';
import { pruneArtifacts, safeArtifactStem, writeFailureReport } from './artifacts';
import { cleanupSyntheticUser } from './cleanup';
import {
  parseNamedStateTag,
  prepareNamedState,
  requireLifecycleConfig,
  resetNamedState,
  SystemDataClient
} from './system-data';
import type { JobSeekerWorld } from './world';

setDefaultTimeout(120_000);

Before(async function (this: JobSeekerWorld, scenario) {
  if (scenario.pickle.tags.some(tag => tag.name === '@framework')) {
    return;
  }
  const tags = scenario.pickle.tags.map(tag => tag.name);
  const state = parseNamedStateTag(tags);
  if (e2eConfig.profile !== 'demo' && !state) {
    throw new Error('Every stateful beta scenario must declare one @state:<NAME> tag.');
  }
  if (state) {
    const lifecycleConfig = requireLifecycleConfig(e2eConfig, state, this.runId);
    this.namedState = state;
    this.systemDataClient = new SystemDataClient(lifecycleConfig);
    this.namedStateDefinition = await prepareNamedState(this.systemDataClient, state);
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
  let teardownError: unknown;
  const attempt = async (action: () => Promise<void>): Promise<void> => {
    try { await action(); } catch (error) { teardownError ??= error; }
  };

  if (scenario.pickle.tags.some(tag => tag.name === '@account-email')) {
    await attempt(async () => { await clearAccountEmailCapture(e2eConfig); });
  }

  if (failed && this.page && e2eConfig.profile !== 'demo') {
    await attempt(async () => {
      await fs.mkdir(artifactDirectory, { recursive: true });
      const screenshot = await this.page!.screenshot({
        path: path.join(artifactDirectory, `${artifactStem}.png`),
        fullPage: true
      });
      await this.attach(screenshot, 'image/png');
      await writeFailureReport(artifactDirectory, artifactStem, e2eConfig.profile);
    });
  }

  if (e2eConfig.profile === 'demo') {
    await attempt(async () => { await this.page?.waitForTimeout(e2eConfig.demoBufferMs); });
    if (this.page) await attempt(async () => { await demoCursor.remove(this.page!); });
  }

  if (this.context && e2eConfig.profile === 'demo' && e2eConfig.saveDemoSession && scenario.result?.status === Status.PASSED) {
    await attempt(async () => {
      const storageStatePath = path.resolve(__dirname, '..', e2eConfig.storageState);
      await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
      await this.context!.storageState({ path: storageStatePath });
    });
  }

  if (this.context && this.tracingStarted) {
    await attempt(async () => {
      await this.context!.tracing.stop(failed ? { path: path.join(artifactDirectory, `${artifactStem}.zip`) } : undefined);
      this.tracingStarted = false;
      if (failed) await pruneArtifacts(artifactDirectory, e2eConfig.maxFailureArtifacts);
    });
  }

  if (this.context) await attempt(async () => { await this.context!.close(); });
  if (video) {
    await attempt(async () => {
      const generatedVideoPath = await video.path();
      const videoName = `${safeArtifactStem(e2eConfig.videoName)}.webm`;
      const targetVideoPath = path.resolve(__dirname, '..', e2eConfig.videoDir, videoName);
      await fs.mkdir(path.dirname(targetVideoPath), { recursive: true });
      await fs.rename(generatedVideoPath, targetVideoPath);
    });
  }
  if (this.browser) await attempt(async () => { await this.browser!.close(); });

  for (const email of this.syntheticUsers) {
    await attempt(async () => {
      if (this.namedState) {
        throw new Error('Stateful beta scenarios must use identities from their named-state definition.');
      }
      await cleanupSyntheticUser(email, {
        enabled: e2eConfig.cleanupEnabled,
        baseUrl: e2eConfig.cleanupBaseUrl,
        token: e2eConfig.cleanupToken,
        profile: e2eConfig.profile
      });
    });
  }

  if (this.systemDataClient && this.namedState) {
    await resetNamedState(
      this.systemDataClient,
      this.namedState,
      scenario.result?.status === Status.FAILED || teardownError !== undefined,
      async () => {
        try {
          await this.attach('Named-state reset also failed; the original scenario failure is preserved.', 'text/plain');
        } catch { /* an evidence failure must not replace the original scenario failure */ }
      }
    );
  }
  if (teardownError !== undefined) throw teardownError;
});
