import { Given, Then, When } from '@cucumber/cucumber';
import {
  alexTaylorDemoUser,
  PUBLIC_NAMED_STATE_PASSWORD
} from '../support/demo-data';
import type { JobSeekerWorld } from '../support/world';

function namedStateUser(world: JobSeekerWorld, identityKey: string) {
  const identity = world.namedStateDefinition?.identities.find(candidate => candidate.key === identityKey);
  if (!identity) throw new Error(`Named state does not define identity ${identityKey}.`);
  return {
    ...alexTaylorDemoUser(),
    fullName: identity.displayName,
    email: identity.email,
    password: PUBLIC_NAMED_STATE_PASSWORD,
    homeLocation: 'RG1 1AA'
  };
}

Given('Alex Taylor is a new job seeker', function (this: JobSeekerWorld) {
  this.demoUser = alexTaylorDemoUser({ uniqueEmail: true });
});

Given('the named-state user {string} is ready to register', function (this: JobSeekerWorld, identityKey: string) {
  this.demoUser = namedStateUser(this, identityKey);
});

Given('the named-state user {string} has an account', function (this: JobSeekerWorld, identityKey: string) {
  this.demoUser = namedStateUser(this, identityKey);
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

When('he signs in with the named-state account', async function (this: JobSeekerWorld) {
  if (!this.demoUser) throw new Error('Named-state user fixture was not loaded.');
  await this.registerPage?.loginUser(this.demoUser);
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

Then('the claimant profile for the named-state user is visible', async function (this: JobSeekerWorld) {
  if (!this.demoUser) throw new Error('Named-state user fixture was not loaded.');
  await this.profilePage?.confirmProfileCompleted(this.demoUser);
});

When('he updates his home location to {string}', async function (this: JobSeekerWorld, postcode: string) {
  await this.profilePage?.updateHomeLocation(postcode);
});

Then('the canonical home location {string} is visible', async function (this: JobSeekerWorld, location: string) {
  await this.profilePage?.expectHomeLocation(location);
});
