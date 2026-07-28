import { Then, When } from '@cucumber/cucumber';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { latestFixtureResetLink } from '../pages/PasswordRecoveryPage';
import { RegisterPage } from '../pages/RegisterPage';
import { createContext } from '../support/browser';
import type { JobSeekerWorld } from '../support/world';

const GENERIC_MESSAGE =
  'If an account exists for that email, a password-reset link has been sent.';

interface PasswordResetState {
  knownResponse?: string;
  unknownResponse?: string;
  actionUrl?: string;
  token?: string;
  replacementPassword?: string;
  previousContexts?: BrowserContext[];
  previousPages?: Page[];
}

const state = new WeakMap<JobSeekerWorld, PasswordResetState>();

function resetState(world: JobSeekerWorld): PasswordResetState {
  const current = state.get(world) ?? {};
  state.set(world, current);
  return current;
}

When('the claimant signs in on two browser sessions', async function (this: JobSeekerWorld) {
  if (!this.browser || !this.demoUser) throw new Error('Account fixture is unavailable.');
  const current = resetState(this);
  current.previousContexts = [];
  current.previousPages = [];
  for (let index = 0; index < 2; index += 1) {
    const context = await createContext(this.browser);
    const page = await context.newPage();
    const login = new RegisterPage(page, this.config.baseUrl);
    await login.loginUser(this.demoUser);
    await expect(page.getByRole('heading', { name: 'Claimant Profile', exact: true })).toBeVisible();
    current.previousContexts.push(context);
    current.previousPages.push(page);
  }
});

Then('both browser sessions are authenticated', async function (this: JobSeekerWorld) {
  const pages = resetState(this).previousPages ?? [];
  expect(pages).toHaveLength(2);
  for (const page of pages) {
    await expect(page.getByRole('heading', { name: 'Claimant Profile', exact: true })).toBeVisible();
  }
});

When('the claimant requests a password reset for the registered email', async function (this: JobSeekerWorld) {
  if (!this.demoUser || !this.passwordRecoveryPage) throw new Error('Account fixture is unavailable.');
  resetState(this).knownResponse = await this.passwordRecoveryPage.requestReset(this.demoUser.email);
});

When('the claimant requests a password reset for an unknown email', async function (this: JobSeekerWorld) {
  if (!this.passwordRecoveryPage) throw new Error('Password recovery page is unavailable.');
  resetState(this).unknownResponse = await this.passwordRecoveryPage.requestReset(
    `unknown-${this.runId}@example.test`
  );
});

Then('the browser shows the approved generic password-reset response', async function (this: JobSeekerWorld) {
  const current = resetState(this);
  const latest = current.unknownResponse ?? current.knownResponse;
  expect(latest).toBe(GENERIC_MESSAGE);
  if (current.knownResponse && current.unknownResponse) {
    expect(current.unknownResponse).toBe(current.knownResponse);
  }
});

When('the claimant opens the fixture-delivered reset link', async function (this: JobSeekerWorld) {
  if (!this.demoUser || !this.passwordRecoveryPage) throw new Error('Account fixture is unavailable.');
  const current = resetState(this);
  current.actionUrl = await latestFixtureResetLink(
    this.config.authenticationFixtureUrl,
    this.config.environmentDataToken,
    this.demoUser.email
  );
  current.token = await this.passwordRecoveryPage.openResetLink(current.actionUrl);
});

Then('the reset token is removed from the browser URL and is not stored', async function (this: JobSeekerWorld) {
  const current = resetState(this);
  if (!current.token || !this.page) throw new Error('Reset token browser state was not captured.');
  expect(new URL(this.page.url()).hash).toBe('');
  expect(new URL(this.page.url()).search).toBe('');
  const storageValues = await this.page.evaluate(() => [
    ...Object.values(localStorage),
    ...Object.values(sessionStorage)
  ]);
  expect(storageValues).not.toContain(current.token);
});

When('the claimant chooses a secure replacement password', async function (this: JobSeekerWorld) {
  if (!this.passwordRecoveryPage) throw new Error('Password recovery page is unavailable.');
  const current = resetState(this);
  current.replacementPassword = `Replacement password ${this.runId}!`;
  await this.passwordRecoveryPage.completeReset(current.replacementPassword);
});

Then('the previous browser sessions and refresh paths are revoked', async function (this: JobSeekerWorld) {
  const contexts = resetState(this).previousContexts ?? [];
  expect(contexts).toHaveLength(2);
  for (const context of contexts) {
    const profile = await context.request.get(new URL('/api/auth/profile', this.config.baseUrl).toString());
    expect(profile.status()).toBe(401);
    const page = await context.newPage();
    await page.goto(new URL('/dashboard', this.config.baseUrl).toString());
    await expect(page.getByRole('tab', { name: /sign in/i })).toBeVisible();
  }
});

Then('the old password is rejected', async function (this: JobSeekerWorld) {
  if (!this.demoUser || !this.page) throw new Error('Account fixture is unavailable.');
  await this.page.goto(new URL('/sign-in', this.config.baseUrl).toString());
  await this.page.getByLabel(/email address/i).fill(this.demoUser.email);
  await this.page.getByLabel(/^password$/i).fill(this.demoUser.password);
  const responsePromise = this.page.waitForResponse(response =>
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/auth/login'
  );
  await this.page.locator('#btn-submit-signin').click();
  const response = await responsePromise;
  expect(response.status()).toBe(401);
  await expect(this.page.getByRole('alert')).toBeVisible();
});

Then('the password reset succeeds and the replacement password can sign in', async function (this: JobSeekerWorld) {
  const current = resetState(this);
  if (!this.demoUser || !current.replacementPassword || !this.registerPage) {
    throw new Error('Replacement sign-in fixture is unavailable.');
  }
  await this.registerPage.loginUser({ ...this.demoUser, password: current.replacementPassword });
  await expect(this.page!.getByRole('heading', { name: 'Claimant Profile', exact: true })).toBeVisible();
  for (const context of current.previousContexts ?? []) {
    await context.close();
  }
});
