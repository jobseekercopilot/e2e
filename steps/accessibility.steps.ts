import AxeBuilder from '@axe-core/playwright';
import { Then, When } from '@cucumber/cucumber';
import { expect, type Page } from '@playwright/test';
import assert from 'node:assert/strict';
import type { JobSeekerWorld } from '../support/world';

function pageFor(world: JobSeekerWorld): Page {
  if (!world.page) throw new Error('Accessibility step requires an active browser page.');
  return world.page;
}

Then('the current beta page has no automated accessibility violations', async function (this: JobSeekerWorld) {
  const result = await new AxeBuilder({ page: pageFor(this) }).analyze();
  assert.deepEqual(
    result.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map(node => node.target)
    })),
    []
  );
});

When('he attempts to continue registration using only the keyboard', async function (this: JobSeekerWorld) {
  const page = pageFor(this);
  const createAccount = page.getByRole('button', { name: 'Create account', exact: true });
  await createAccount.focus();
  await createAccount.press('Enter');
});

Then('registration validation focus moves to the error summary', async function (this: JobSeekerWorld) {
  const alert = pageFor(this).getByRole('alert');
  await expect(alert).toBeFocused();
  await expect(alert).toContainText('Confirm the current Terms of Use, Privacy Notice and UK 18+ eligibility');
  await expect(pageFor(this).getByRole('checkbox', {
    name: /aged 18 or over, accept the terms of use and acknowledge the privacy notice/i,
  })).toHaveAttribute('aria-invalid', 'true');
});

When('he completes registration using only the keyboard', async function (this: JobSeekerWorld) {
  if (!this.demoUser) throw new Error('Named-state user fixture was not loaded.');
  const page = pageFor(this);
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/auth/register') {
      this.registrationRequestCount += 1;
    }
  });

  const registrationForm = page.locator('#mode-create-segment form');
  await registrationForm.getByLabel(/full name/i).fill(this.demoUser.fullName);
  await registrationForm.getByLabel(/email address/i).fill(this.demoUser.email);
  const password = registrationForm.getByLabel(/^password$/i);
  await password.fill(this.demoUser.password);
  const legalAcknowledgement = registrationForm.getByRole('checkbox', {
    name: /aged 18 or over, accept the terms of use and acknowledge the privacy notice/i,
  });
  await legalAcknowledgement.focus();
  await legalAcknowledgement.press('Space');
  await password.press('Enter');
  await password.press('Enter').catch(() => undefined);
  await expect(page.getByRole('heading', { name: /find the right opportunities/i })).toBeVisible();
  await new AxeBuilder({ page }).analyze().then(result => assert.equal(result.violations.length, 0));

  const roles = page.getByLabel('Target roles', { exact: true });
  await roles.fill(this.demoUser.targetRoles[0] ?? 'Software Developer');
  const continueSetup = page.getByRole('button', { name: 'Continue', exact: true });
  await continueSetup.focus();
  await continueSetup.press('Enter');
  await expect(page.getByRole('heading', { name: /where do you want to work/i })).toBeVisible();
  await new AxeBuilder({ page }).analyze().then(result => assert.equal(result.violations.length, 0));

  const location = page.getByLabel(/search postcode/i);
  await location.fill(this.demoUser.homeLocation);
  const suggestion = page.getByRole('listbox', { name: /matching uk locations/i })
    .getByRole('option')
    .first();
  await expect(suggestion).toBeVisible();
  await suggestion.focus();
  await suggestion.press('Enter');

  await continueSetup.focus();
  await continueSetup.press('Enter');
  await expect(page.getByRole('heading', { name: /how would you like to work/i })).toBeVisible();
  await page.getByRole('checkbox').first().check();
  const finishSetup = page.getByRole('button', { name: 'Finish setup', exact: true });
  await finishSetup.focus();
  await finishSetup.press('Enter');
  await finishSetup.press('Enter').catch(() => undefined);
  await expect(page.getByTestId('job-search-preferences')).toBeVisible();
});

Then('only one registration request was sent', function (this: JobSeekerWorld) {
  assert.equal(this.registrationRequestCount, 1);
});

When('he edits his profile while location search is unavailable', async function (this: JobSeekerWorld) {
  const page = pageFor(this);
  await page.route('**/api/v2/locations/autocomplete*', async route => {
    // Keep the loading announcement observable long enough for assistive-
    // technology assertions before returning the deterministic failure.
    await new Promise(resolve => setTimeout(resolve, 1_500));
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, locations: [], message: 'private upstream detail' })
    });
  });
  const edit = page.getByRole('button', { name: /edit location and commute/i });
  await edit.focus();
  await edit.press('Enter');
  await page.getByLabel(/town or postcode/i).fill('Unavailable place');
  await expect(page.getByTestId('profile-location-status'))
    .toContainText('Searching locations');
});

Then('loading and safe unavailable location feedback are announced', async function (this: JobSeekerWorld) {
  const status = pageFor(this).getByTestId('profile-location-status');
  await expect(status).toContainText('Location search is temporarily unavailable');
  await expect(status).not.toContainText('private upstream detail');
  await expect(status).toHaveAttribute('role', 'alert');
});

When('he saves the profile twice in rapid succession', async function (this: JobSeekerWorld) {
  const page = pageFor(this);
  // Preserve the failure feedback proof but submit a contract-valid postcode;
  // provider unavailability must not turn this duplicate-write check into a
  // backend validation test.
  await page.unroute('**/api/v2/locations/autocomplete*');
  await page.getByLabel(/town or postcode/i).fill('RG1 1AA');
  const suggestion = page.getByRole('listbox', { name: /matching uk locations/i })
    .getByRole('option')
    .first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  page.on('request', request => {
    if (request.method() === 'PATCH' && new URL(request.url()).pathname === '/api/auth/profile') {
      this.profileUpdateRequestCount += 1;
    }
  });
  await page.route('**/api/auth/profile', async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.continue();
  });
  const save = page.getByRole('button', { name: 'Save this section', exact: true });
  await save.focus();
  await save.press('Enter');
  await save.press('Enter').catch(() => undefined);
  await expect(page.getByRole('button', { name: /edit location and commute/i })).toBeVisible();
});

Then('only one profile update request was sent', function (this: JobSeekerWorld) {
  assert.equal(this.profileUpdateRequestCount, 1);
});
