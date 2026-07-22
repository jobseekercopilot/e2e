import { Given, Then } from '@cucumber/cucumber';
import fs from 'node:fs';
import path from 'node:path';
import { alexTaylorDemoUser, softwareDeveloperSearchFixture } from '../support/demo-data';
import type { JobSeekerWorld } from '../support/world';

Given('Alex Taylor is logged in', async function (this: JobSeekerWorld) {
  this.demoUser = alexTaylorDemoUser();
  this.jobSearch = softwareDeveloperSearchFixture();

  const storageStatePath = path.resolve(__dirname, '..', this.config.storageState);

  if (this.config.useSavedSession && !fs.existsSync(storageStatePath)) {
    throw new Error(`Saved demo session was not found at ${storageStatePath}. Run npm run record first.`);
  }

  await this.registerPage?.open();

  const alreadyOnDashboard = await this.page
    ?.getByRole('heading', { name: /job matches|job seeker dashboard|claimant profile/i })
    .first()
    .isVisible()
    .catch(() => false);

  if (alreadyOnDashboard) {
    await this.dashboardPage?.waitForDashboard();
    await this.profilePage?.confirmProfileCompleted(this.demoUser);
    return;
  }

  if (this.config.useSavedSession) {
    throw new Error('Saved demo session did not open the dashboard. Run npm run record again before recording dashboard-based promo clips.');
  }

  await this.registerPage?.loginUser(this.demoUser);
  await this.dashboardPage?.waitForDashboard();
  await this.profilePage?.confirmProfileCompleted(this.demoUser);
});

Then('the promo shot pauses at the final trailer state', async function (this: JobSeekerWorld) {
  await this.page?.waitForTimeout(this.config.demoBufferMs);
});
