import { Given, Then, When } from '@cucumber/cucumber';
import { alexTaylorDemoUser } from '../support/demo-data';
import type { JobSeekerWorld } from '../support/world';

Given('Alex Taylor is a new job seeker', function (this: JobSeekerWorld) {
  this.demoUser = alexTaylorDemoUser({ uniqueEmail: true });
});

When('he opens Job Seeker Copilot', async function (this: JobSeekerWorld) {
  await this.registerPage?.open();
});

When('he registers an account', async function (this: JobSeekerWorld) {
  if (!this.demoUser) {
    throw new Error('Demo user fixture was not loaded.');
  }

  await this.registerPage?.registerUser(this.demoUser);
});

When('he completes his job seeker profile', async function (this: JobSeekerWorld) {
  if (!this.demoUser) {
    throw new Error('Demo user fixture was not loaded.');
  }

  await this.profilePage?.confirmProfileCompleted(this.demoUser);
});

Then('he should arrive on the dashboard', async function (this: JobSeekerWorld) {
  await this.dashboardPage?.expectLoaded();
});
