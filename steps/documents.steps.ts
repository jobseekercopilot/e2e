import { Then, When } from '@cucumber/cucumber';
import type { JobSeekerWorld } from '../support/world';

When('he opens the documents workspace', async function (this: JobSeekerWorld) {
  await this.documentsPage?.open();
});

When('he views generated documents if demo data exists', async function (this: JobSeekerWorld) {
  await this.documentsPage?.open();
  const visible = await this.documentsPage?.waitForDocuments();
  if (!visible) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
  }
});

Then('generated documents should be visible if demo data exists', async function (this: JobSeekerWorld) {
  const visible = await this.documentsPage?.waitForDocuments();
  if (!visible) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
  }
});

Then('he opens document version history if available', async function (this: JobSeekerWorld) {
  const visible = await this.documentsPage?.showFirstDocumentVersionHistory();
  if (!visible) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
  }
});

Then('he previews and downloads stored documents if available', async function (this: JobSeekerWorld) {
  const downloads = await this.documentsPage?.previewAndDownloadDocuments() ?? [];
  this.demoDownloads.push(...downloads.map((download) => download.path));
  if (downloads.length === 0) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
  }
});
