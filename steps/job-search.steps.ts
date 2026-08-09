import { Then, When } from '@cucumber/cucumber';
import { softwareDeveloperSearchFixture } from '../support/demo-data';
import type { JobSeekerWorld } from '../support/world';

When('he opens the job search workspace', async function (this: JobSeekerWorld) {
  await this.jobSearchPage?.open();
});

When('he searches for software developer jobs', async function (this: JobSeekerWorld) {
  this.jobSearch = this.jobSearch ?? softwareDeveloperSearchFixture();
  await this.jobSearchPage?.searchForSoftwareDeveloperJobs(this.jobSearch);
});

Then('relevant job results should be visible', async function (this: JobSeekerWorld) {
  await this.jobSearchPage?.waitForResults();
});

Then('NHS and apprenticeship vacancies should be visible', async function (this: JobSeekerWorld) {
  await this.jobSearchPage?.expectSpecialistVacancies();
});

Then('apprenticeship training and location details should be preserved', async function (this: JobSeekerWorld) {
  await this.jobSearchPage?.expectApprenticeshipDetails();
});

Then('the promo shot scrolls through job results', async function (this: JobSeekerWorld) {
  await this.jobSearchPage?.smoothScrollResults();
  await this.page?.waitForTimeout(this.config.demoBufferMs);
});

When('he opens a relevant software developer job', async function (this: JobSeekerWorld) {
  await this.jobSearchPage?.openFirstRelevantJob();
});

When('he opens a software developer job', async function (this: JobSeekerWorld) {
  this.jobSearch = this.jobSearch ?? softwareDeveloperSearchFixture();
  await this.jobSearchPage?.open();
  await this.jobSearchPage?.searchForSoftwareDeveloperJobs(this.jobSearch);
  await this.jobSearchPage?.openFirstRelevantJob();
});

Then('the job details should be visible', async function (this: JobSeekerWorld) {
  await this.jobDetailsPage?.waitForDetails();
});

Then('document generation actions should be visible if available', async function (this: JobSeekerWorld) {
  const visible = await this.jobDetailsPage?.expectGenerationActionsIfAvailable();
  if (!visible) {
    return 'pending';
  }
});
