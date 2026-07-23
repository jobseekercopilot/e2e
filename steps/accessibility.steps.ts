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
  const next = page.getByRole('button', { name: /next step/i });
  await next.focus();
  await next.press('Enter');
});

Then('registration validation focus moves to the error summary', async function (this: JobSeekerWorld) {
  const alert = pageFor(this).getByRole('alert');
  await expect(alert).toBeFocused();
  await expect(alert).toContainText('Check your name, email address and password');
  await expect(pageFor(this).getByLabel(/full name/i)).toHaveAttribute('aria-invalid', 'true');
});

When('he completes registration using only the keyboard', async function (this: JobSeekerWorld) {
  if (!this.demoUser) throw new Error('Named-state user fixture was not loaded.');
  const page = pageFor(this);
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/auth/register') {
      this.registrationRequestCount += 1;
    }
  });

  await page.getByLabel(/full name/i).fill(this.demoUser.fullName);
  await page.getByLabel(/contact email address/i).fill(this.demoUser.email);
  const password = page.getByLabel(/^password$/i);
  await password.fill(this.demoUser.password);
  await password.press('Enter');
  await expect(page.getByRole('heading', { name: /professional history/i })).toBeVisible();
  await new AxeBuilder({ page }).analyze().then(result => assert.equal(result.violations.length, 0));

  const skills = page.getByLabel('Core Skills');
  await skills.fill(this.demoUser.skills[0] ?? 'TypeScript');
  await skills.press('Enter');
  const roles = page.getByLabel(/target roles/i);
  await roles.fill(this.demoUser.targetRoles[0] ?? 'Software Developer');
  await roles.press('Enter');
  const next = page.getByRole('button', { name: /next step/i });
  await next.focus();
  await next.press('Enter');
  await expect(page.getByRole('heading', { name: /job search preferences/i })).toBeVisible();
  await new AxeBuilder({ page }).analyze().then(result => assert.equal(result.violations.length, 0));

  const location = page.getByLabel(/home location/i);
  await location.fill(this.demoUser.homeLocation);
  const suggestion = page.getByTestId('registration-location-suggestions').getByRole('button').first();
  await expect(suggestion).toBeVisible();
  await suggestion.focus();
  await suggestion.press('Enter');

  const submit = page.getByRole('button', { name: /create profile/i }).last();
  await submit.focus();
  await submit.press('Enter');
  await submit.press('Enter').catch(() => undefined);
  await expect(page.getByRole('heading', { name: 'Claimant Profile', exact: true })).toBeVisible();
});

Then('only one registration request was sent', function (this: JobSeekerWorld) {
  assert.equal(this.registrationRequestCount, 1);
});

When('he edits his profile while location search is unavailable', async function (this: JobSeekerWorld) {
  const page = pageFor(this);
  await page.route('**/api/locations?*', async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, locations: [], message: 'private upstream detail' })
    });
  });
  const edit = page.getByRole('button', { name: /^edit$/i });
  await edit.focus();
  await edit.press('Enter');
  await page.getByTestId('profile-home-location-input').fill('Unavailable place');
});

Then('loading and safe unavailable location feedback are announced', async function (this: JobSeekerWorld) {
  const status = pageFor(this).getByTestId('profile-location-status');
  await expect(status).toContainText('Searching locations');
  await expect(status).toContainText('Location search is temporarily unavailable');
  await expect(status).not.toContainText('private upstream detail');
  await expect(status).toHaveAttribute('role', 'alert');
});

When('he saves the profile twice in rapid succession', async function (this: JobSeekerWorld) {
  const page = pageFor(this);
  // Preserve the failure feedback proof but submit a contract-valid postcode;
  // provider unavailability must not turn this duplicate-write check into a
  // backend validation test.
  await page.getByTestId('profile-home-location-input').fill('RG1 1AA');
  page.on('request', request => {
    if (request.method() === 'PUT' && new URL(request.url()).pathname === '/api/auth/profile') {
      this.profileUpdateRequestCount += 1;
    }
  });
  await page.route('**/api/auth/profile', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.continue();
  });
  const save = page.locator('#btn-save-inline');
  await save.focus();
  await save.press('Enter');
  await save.press('Enter').catch(() => undefined);
  await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible();
});

Then('only one profile update request was sent', function (this: JobSeekerWorld) {
  assert.equal(this.profileUpdateRequestCount, 1);
});
