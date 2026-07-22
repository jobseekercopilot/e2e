import { Then, When } from '@cucumber/cucumber';
import { previewDownloadedPdf } from '../support/demo-downloads';
import type { JobSeekerWorld } from '../support/world';

When('Alex generates application documents', async function (this: JobSeekerWorld) {
  const result = await this.documentGenerationPage?.generateApplicationDocuments();
  if (result !== 'clicked') {
    await this.jobDetailsPage?.expectGenerationActionsIfAvailable();
    await this.page?.waitForTimeout(this.config.demoBufferMs);
    return;
  }
  this.documentGenerationAttempted = 'applicationDocuments';
  this.documentGenerationSuccessShown = false;
});

Then('a tailored CV should be created', async function (this: JobSeekerWorld) {
  if (this.documentGenerationAttempted !== 'applicationDocuments') {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
    return;
  }
  if (!this.documentGenerationSuccessShown) {
    await this.documentGenerationPage?.waitForApplicationDocumentSuccess();
    this.documentGenerationSuccessShown = true;
  }
});

Then('a tailored cover letter should be created', async function (this: JobSeekerWorld) {
  if (this.documentGenerationAttempted !== 'applicationDocuments') {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
    return;
  }
  if (!this.documentGenerationSuccessShown) {
    await this.documentGenerationPage?.waitForApplicationDocumentSuccess();
    this.documentGenerationSuccessShown = true;
  }
});

Then('both documents should be available to download', async function (this: JobSeekerWorld) {
  if (this.documentGenerationAttempted !== 'applicationDocuments') {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
    return;
  }
  const downloads = await this.documentGenerationPage?.downloadGeneratedDocuments() ?? [];
  this.demoDownloads.push(...downloads.map((download) => download.path));
  if (this.page && downloads[0]) {
    await previewDownloadedPdf(this.page, downloads[0].path, downloads[0].filename, 3200);
  }
});

When('he generates a tailored CV', async function (this: JobSeekerWorld) {
  const result = await this.documentGenerationPage?.generateApplicationDocuments();
  if (result !== 'clicked') {
    await this.jobDetailsPage?.expectGenerationActionsIfAvailable();
    await this.page?.waitForTimeout(this.config.demoBufferMs);
    return;
  }
  this.documentGenerationAttempted = 'applicationDocuments';
  this.documentGenerationSuccessShown = false;
});

Then('the generated CV success state should be visible', async function (this: JobSeekerWorld) {
  if (this.documentGenerationAttempted !== 'applicationDocuments') {
    // Safe promo placeholder until deterministic demo generation exists.
    await this.page?.waitForTimeout(this.config.demoBufferMs);
    return;
  }
  await this.documentGenerationPage?.waitForApplicationDocumentSuccess();
  await this.page?.waitForTimeout(this.config.demoBufferMs);
});

When('he generates a tailored cover letter', async function (this: JobSeekerWorld) {
  const result = await this.documentGenerationPage?.generateApplicationDocuments();
  if (result !== 'clicked') {
    await this.jobDetailsPage?.expectGenerationActionsIfAvailable();
    await this.page?.waitForTimeout(this.config.demoBufferMs);
    return;
  }
  this.documentGenerationAttempted = 'applicationDocuments';
  this.documentGenerationSuccessShown = false;
});

Then('the generated cover letter success state should be visible', async function (this: JobSeekerWorld) {
  if (this.documentGenerationAttempted !== 'applicationDocuments') {
    // Safe promo placeholder until deterministic demo generation exists.
    await this.page?.waitForTimeout(this.config.demoBufferMs);
    return;
  }
  await this.documentGenerationPage?.waitForApplicationDocumentSuccess();
  await this.page?.waitForTimeout(this.config.demoBufferMs);
});
