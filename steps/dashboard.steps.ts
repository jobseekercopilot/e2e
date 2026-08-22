import { Then, When } from '@cucumber/cucumber';
import type { JobSeekerWorld } from '../support/world';

When('he opens the dashboard workspace', async function (this: JobSeekerWorld) {
  await this.navigationPage?.goToDashboard();
});

Then('the dashboard should be visible and populated', async function (this: JobSeekerWorld) {
  await this.dashboardPage?.waitForDashboardWidgets();
});

Then('the promo shot pauses on the dashboard', async function (this: JobSeekerWorld) {
  await this.dashboardPage?.pauseForReveal();
});

Then('the activity timeline should be visible if demo data exists', async function (this: JobSeekerWorld) {
  const visible = await this.dashboardPage?.showActivityTimeline();
  if (!visible) {
    await this.dashboardPage?.pauseForReveal();
  }
});

Then('the promo shot pauses on the activity timeline', async function (this: JobSeekerWorld) {
  await this.page?.waitForTimeout(this.config.demoBufferMs);
});
