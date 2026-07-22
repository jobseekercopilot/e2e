import { Then, When } from '@cucumber/cucumber';
import type { JobSeekerWorld } from '../support/world';

When('he opens the AI credit workspace', async function (this: JobSeekerWorld) {
  await this.aiCreditPage?.open();
});

When('he adds demo AI credit', async function (this: JobSeekerWorld) {
  await this.aiCreditPage?.addDemoCredit();
});

Then('AI credit balance or spending log should be visible', async function (this: JobSeekerWorld) {
  await this.aiCreditPage?.waitForBalance();
  await this.aiCreditPage?.waitForSpendingLog();
  await this.page?.waitForTimeout(this.config.demoBufferMs);
});

Then('no real payment is started', async function (this: JobSeekerWorld) {
  await this.aiCreditPage?.assertCheckoutNotStarted();
});
