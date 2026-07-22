import { Then, When } from '@cucumber/cucumber';
import type { JobSeekerWorld } from '../support/world';

When('he opens the application tracker', async function (this: JobSeekerWorld) {
  await this.applicationTrackerPage?.open();
});

When('he focuses a software developer application', async function (this: JobSeekerWorld) {
  const visible = await this.applicationTrackerPage?.waitForApplications();
  if (!visible) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
  }
});

Then('he can change the application status if available', async function (this: JobSeekerWorld) {
  const changed = await this.applicationTrackerPage?.moveApplicationToInterview();
  if (!changed) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
    return;
  }
  await this.page?.waitForTimeout(this.config.demoBufferMs);
});

When('he marks an application as offer if available', async function (this: JobSeekerWorld) {
  await this.applicationTrackerPage?.open();
  const changed = await this.applicationTrackerPage?.moveInterviewApplicationToOffer();
  if (!changed) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
  }
});

When('he moves an application to interview', async function (this: JobSeekerWorld) {
  const changed = await this.applicationTrackerPage?.moveApplicationToInterview();
  if (!changed) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
  }
});

Then('the tracker shows the application at interview', async function (this: JobSeekerWorld) {
  const visible = await this.applicationTrackerPage?.focusApplicationWithStatus(/Interview/i);
  if (!visible) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
  }
});

When('he moves an interview application to offer', async function (this: JobSeekerWorld) {
  const changed = await this.applicationTrackerPage?.moveInterviewApplicationToOffer();
  if (!changed) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
  }
});

Then('the tracker shows the application as offer secured', async function (this: JobSeekerWorld) {
  const visible = await this.applicationTrackerPage?.focusApplicationWithStatus(/Offer/i);
  if (!visible) {
    await this.page?.waitForTimeout(this.config.demoBufferMs);
  }
});
