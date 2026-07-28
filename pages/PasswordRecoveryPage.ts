import { expect, type Page } from '@playwright/test';

const GENERIC_MESSAGE =
  'If an account exists for that email, a password-reset link has been sent.';

export class PasswordRecoveryPage {
  constructor(
    private readonly page: Page,
    private readonly baseUrl: string
  ) {}

  async requestReset(email: string): Promise<string> {
    await this.page.goto(new URL('/forgot-password', this.baseUrl).toString());
    await expect(this.page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await this.page.getByLabel('Email address').fill(email);
    const responsePromise = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/auth/password-reset/request'
    );
    await this.page.getByRole('button', { name: 'Send reset link' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(202);
    const status = this.page.getByRole('status');
    await expect(status).toHaveText(GENERIC_MESSAGE);
    return (await status.textContent())?.trim() ?? '';
  }

  async openResetLink(actionUrl: string): Promise<string> {
    const link = new URL(actionUrl);
    const expectedOrigin = new URL(this.baseUrl).origin;
    if (link.origin !== expectedOrigin || link.pathname !== '/reset-password') {
      throw new Error('Fixture reset link must target the configured application reset route.');
    }
    const token = new URLSearchParams(link.hash.slice(1)).get('token') ?? '';
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
      throw new Error('Fixture reset link did not contain a bounded URL-safe token.');
    }

    await this.page.goto(link.toString());
    await expect(this.page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await expect(this.page).toHaveURL(new RegExp(`${escapeRegex(expectedOrigin)}/reset-password$`));
    const storedValues = await this.page.evaluate(() => [
      ...Object.values(localStorage),
      ...Object.values(sessionStorage)
    ]);
    expect(storedValues).not.toContain(token);
    await expect(this.page.locator('body')).not.toContainText(token);
    return token;
  }

  async completeReset(newPassword: string): Promise<void> {
    await this.page.getByLabel('New password').fill(newPassword);
    const responsePromise = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/auth/password-reset/complete'
    );
    await this.page.getByRole('button', { name: 'Change password' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await expect(this.page.getByRole('status')).toContainText(
      'Your password has been changed. Sign in with your new password.'
    );
  }
}

export async function latestFixtureResetLink(
  fixtureBaseUrl: string | undefined,
  environmentDataToken: string | undefined,
  recipient: string
): Promise<string> {
  const { base, token } = validateFixtureAccess(fixtureBaseUrl, environmentDataToken);
  const url = new URL('/internal/system-data/account-email/latest', base);
  url.searchParams.set('recipient', recipient);
  url.searchParams.set('purpose', 'PASSWORD_RESET');
  const response = await fetch(url, {
    headers: { 'X-Environment-Data-Token': token }
  });
  if (!response.ok) throw new Error(`Fixture account-email lookup failed with HTTP ${response.status}.`);
  const body = await response.json() as { actionUrl?: unknown };
  if (typeof body.actionUrl !== 'string') {
    throw new Error('Fixture account-email response did not contain an action URL.');
  }
  return body.actionUrl;
}

export async function fixtureAccountEmailExists(
  fixtureBaseUrl: string | undefined,
  environmentDataToken: string | undefined,
  recipient: string,
  purpose: 'PASSWORD_RESET' | 'PASSWORD_CHANGED'
): Promise<boolean> {
  const { base, token } = validateFixtureAccess(fixtureBaseUrl, environmentDataToken);
  const url = new URL('/internal/system-data/account-email/latest', base);
  url.searchParams.set('recipient', recipient);
  url.searchParams.set('purpose', purpose);
  const response = await fetch(url, {
    headers: { 'X-Environment-Data-Token': token }
  });
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`Fixture account-email lookup failed with HTTP ${response.status}.`);
  }
  return true;
}

export async function clearFixtureAccountEmails(
  fixtureBaseUrl: string | undefined,
  environmentDataToken: string | undefined
): Promise<void> {
  const { base, token } = validateFixtureAccess(fixtureBaseUrl, environmentDataToken);
  const response = await fetch(
    new URL('/internal/system-data/account-email', base),
    {
      method: 'DELETE',
      headers: { 'X-Environment-Data-Token': token }
    }
  );
  if (response.status !== 204) {
    throw new Error(`Fixture account-email cleanup failed with HTTP ${response.status}.`);
  }
}

function validateFixtureAccess(
  fixtureBaseUrl: string | undefined,
  environmentDataToken: string | undefined
): { base: string; token: string } {
  const base = validateFixtureBaseUrl(fixtureBaseUrl);
  if (!environmentDataToken || environmentDataToken.length < 32 || /\s/.test(environmentDataToken)) {
    throw new Error('ENVIRONMENT_DATA_TOKEN must be a non-whitespace runtime value of at least 32 characters.');
  }
  return { base, token: environmentDataToken };
}

function validateFixtureBaseUrl(value: string | undefined): string {
  if (!value) throw new Error('AUTHENTICATION_FIXTURE_URL is required for account-email E2E tests.');
  const url = new URL(value);
  const allowedHost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  const allowedPort = ['8084', '9104'].includes(url.port);
  if (url.protocol !== 'http:' || !allowedHost || !allowedPort
      || url.username || url.password || url.search || url.hash
      || (url.pathname !== '' && url.pathname !== '/')) {
    throw new Error('AUTHENTICATION_FIXTURE_URL must be bounded to the local test-stack auth port.');
  }
  return url.origin;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
