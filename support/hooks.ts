import { After, Before, setDefaultTimeout, Status } from '@cucumber/cucumber';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createContext, createPage, launchBrowser } from './browser';
import { e2eConfig } from './config';
import { clearAccountEmailCapture } from './account-email-capture';
import { demoCursor } from './demo-cursor';
import {
  makeArtifactPrivate,
  pruneArtifacts,
  safeArtifactStem,
  safeRequestUrl,
  writeCapacityScenarioReport,
  writeFailureReport
} from './artifacts';
import { cleanupSyntheticUser } from './cleanup';
import {
  parseNamedStateTag,
  prepareNamedState,
  requireLifecycleConfig,
  resetNamedState,
  SystemDataClient
} from './system-data';
import { shouldPreserveDemoReady } from './stabilisation-preservation';
import {
  enforceStabilisationScenarioSafety,
  installZeroCreditGenerationFirewall
} from './stabilisation-runtime-safety';
import type { JobSeekerWorld } from './world';

setDefaultTimeout(120_000);

Before(async function (this: JobSeekerWorld, scenario) {
  if (scenario.pickle.tags.some(tag => tag.name === '@framework')) {
    return;
  }
  const tags = scenario.pickle.tags.map(tag => tag.name);
  const capacityWorkload = tags.includes('@capacity-workload');
  if (capacityWorkload && !e2eConfig.capacityFixtureConfirmed) {
    throw new Error('Capacity workloads require CAPACITY_FIXTURE_CONFIRMED=true after infrastructure preflight.');
  }
  this.scenarioStartedAt = new Date().toISOString();
  this.consoleErrors.length = 0;
  this.networkErrors.length = 0;
  this.networkSamples.length = 0;
  enforceStabilisationScenarioSafety(tags, e2eConfig);
  const state = parseNamedStateTag(tags);
  if (e2eConfig.profile !== 'demo' && !state) {
    throw new Error('Every stateful beta scenario must declare one @state:<NAME> tag.');
  }
  // The capacity orchestrator prepares DEMO_READY exactly once. Concurrent
  // browser workers must not race by resetting/reseeding the same fixture.
  if (state && !capacityWorkload) {
    const lifecycleConfig = requireLifecycleConfig(e2eConfig, state, this.runId);
    this.namedState = state;
    this.systemDataClient = new SystemDataClient(lifecycleConfig);
    this.namedStateDefinition = await prepareNamedState(this.systemDataClient, state);
  }
  this.browser = await launchBrowser();
  this.context = await createContext(this.browser);
  this.zeroCreditGenerationFirewall =
    await installZeroCreditGenerationFirewall(this.context, tags);
  if (e2eConfig.profile !== 'demo') {
    await this.context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    this.tracingStarted = true;
  }
  const page = await createPage(this.context);
  const requestStartedAt = new WeakMap<object, number>();
  page.on('request', request => requestStartedAt.set(request, Date.now()));
  page.on('console', message => {
    if (message.type() === 'error') this.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => this.consoleErrors.push(error.message));
  page.on('requestfailed', request => {
    this.networkErrors.push({
      method: request.method(),
      url: safeRequestUrl(request.url()),
      failure: request.failure()?.errorText ?? 'request failed'
    });
  });
  page.on('response', response => {
    const request = response.request();
    const startedAt = requestStartedAt.get(request);
    const sample = {
      method: request.method(),
      url: safeRequestUrl(response.url()),
      status: response.status(),
      ...(startedAt === undefined ? {} : { durationMs: Date.now() - startedAt })
    };
    if (tags.includes('@capacity-workload')) this.networkSamples.push(sample);
    if (response.status() >= 400) this.networkErrors.push(sample);
  });
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
      const screenshotPath = path.join(artifactDirectory, `${artifactStem}.png`);
      const screenshot = await this.page!.screenshot({
        path: screenshotPath,
        fullPage: true
      });
      await makeArtifactPrivate(screenshotPath);
      await this.attach(screenshot, 'image/png');
      await writeFailureReport(artifactDirectory, artifactStem, e2eConfig.profile, {
        scenario: scenario.pickle.name,
        tags: scenario.pickle.tags.map(tag => tag.name),
        startedAt: this.scenarioStartedAt,
        finishedAt: new Date().toISOString(),
        error: scenario.result?.message,
        consoleErrors: this.consoleErrors,
        networkErrors: this.networkErrors
      });
    });
  }

  if (scenario.pickle.tags.some(tag => tag.name === '@capacity-workload')) {
    await attempt(async () => {
      const reportDirectory = path.resolve(__dirname, '..', e2eConfig.capacityResultDir);
      await writeCapacityScenarioReport(reportDirectory, artifactStem, {
        schemaVersion: 1,
        runId: this.runId,
        scenario: scenario.pickle.name,
        status: scenario.result?.status,
        startedAt: this.scenarioStartedAt,
        finishedAt: new Date().toISOString(),
        responseCount: this.networkSamples.length,
        errorCount: this.networkErrors.length,
        consoleErrorCount: this.consoleErrors.length,
        responses: this.networkSamples,
        errors: this.networkErrors
      });
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

  if (this.zeroCreditGenerationFirewall) {
    await attempt(async () => {
      this.zeroCreditGenerationFirewall!.assertNoAttempts();
    });
    await attempt(async () => {
      await this.zeroCreditGenerationFirewall!.stop();
      this.zeroCreditGenerationFirewall = undefined;
    });
  }

  if (this.context && this.tracingStarted) {
    await attempt(async () => {
      const tracePath = path.join(artifactDirectory, `${artifactStem}.zip`);
      await this.context!.tracing.stop(failed ? { path: tracePath } : undefined);
      this.tracingStarted = false;
      if (failed) {
        await makeArtifactPrivate(tracePath);
        await pruneArtifacts(artifactDirectory, e2eConfig.maxFailureArtifacts);
      }
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

  const preserveNamedState = shouldPreserveDemoReady({
    enabled: this.config.preserveDemoReadyAfterRun,
    profile: this.config.profile,
    liveProfile: process.env.LIVE_STABILISATION_PROFILE,
    allowAiGeneration: this.config.allowAiGeneration,
    state: this.namedState,
    tags: scenario.pickle.tags.map(tag => tag.name),
    scenarioPassed: scenario.result?.status === Status.PASSED,
    teardownSucceeded: teardownError === undefined
  });
  if (this.systemDataClient && this.namedState && !preserveNamedState) {
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
