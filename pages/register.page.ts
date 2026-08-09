import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';
import { e2eConfig } from '../support/config';
import type { DemoUser } from '../support/world';

export class RegisterPage extends BasePage {
  constructor(page: Page, private readonly baseUrl: string) {
    super(page);
  }

  async open(): Promise<void> {
    await this.page.goto(this.baseUrl);
    await expect(this.page).toHaveURL(/\/dashboard|\/$/);
    await this.page.addStyleTag({
      content: 'html, body, * { overflow-anchor: none !important; }'
    });
    await this.page.waitForTimeout(e2eConfig.demoBufferMs);
  }

  async registerUser(user: DemoUser): Promise<void> {
    await this.startCreateProfile();
    await this.enterAccountDetails(user);
    await this.submitRegistration();
    await this.completeSearchSetup(user);
  }

  async loginUser(user: DemoUser): Promise<void> {
    await this.page.goto(this.baseUrl);
    await this.page.addStyleTag({
      content: 'html, body, * { overflow-anchor: none !important; }'
    });
    await this.clickFramed(
      this.byTestId('sign-in-tab')
        .or(this.page.locator('#tab-btn-signin'))
        .or(this.page.getByRole('tab', { name: /sign in/i }))
        .or(this.page.getByRole('button', { name: /sign in/i }))
    );
    await this.humanFillInPlace(this.page.getByLabel(/email address/i), user.email);
    await this.humanFillInPlace(this.page.getByLabel(/^password$/i), user.password);
    const responsePromise = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && response.url().includes('/api/auth/login')
    );
    await this.clickCentered(
      this.byTestId('submit-sign-in-button')
        .or(this.page.locator('#btn-submit-signin'))
        .or(this.page.getByRole('button', { name: 'Sign in', exact: true }))
        .first()
    );
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`Sign in failed with HTTP ${response.status()}.`);
    }
    await expect(this.byTestId('job-search-preferences')).toBeVisible();
  }

  private async startCreateProfile(): Promise<void> {
    const createProfileTab = this.byTestId('create-profile-tab')
      .or(this.page.locator('#tab-btn-create'))
      .or(this.page.getByRole('tab', { name: /create profile/i }))
      .or(this.page.getByRole('button', { name: /create profile/i }));
    await this.clickFramed(createProfileTab);
  }

  private async enterAccountDetails(user: DemoUser): Promise<void> {
    await this.humanFillFramed(this.page.getByLabel(/full name/i), user.fullName);
    await this.humanFillFramed(this.page.getByLabel(/email address/i), user.email);
    await this.humanFillFramed(this.page.getByLabel(/^password$/i), user.password);
  }

  private async submitRegistration(): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && response.url().includes('/api/auth/register')
    );
    await this.clickFramed(
      this.byTestId('submit-registration-button')
        .or(this.page.locator('#btn-submit-signup'))
    );
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(
        `Registration failed with HTTP ${response.status()}: ${await response.text()}`
      );
    }
    await expect(
      this.page.getByRole('heading', {name: 'Let’s find the right opportunities', exact: true})
    ).toBeVisible();
  }

  private async completeSearchSetup(user: DemoUser): Promise<void> {
    await this.humanFillFramed(
      this.page.getByLabel('Target roles', {exact: true}),
      user.targetRoles.join(', '),
    );
    await this.clickFramed(this.page.getByRole('button', {name: 'Continue', exact: true}));

    await this.humanFillFramed(
      this.page.getByLabel('Search postcode', {exact: true}),
      user.homeLocation,
    );
    const suggestions = this.page.getByRole('listbox', {name: 'Matching UK locations'});
    await expect(suggestions).toBeVisible();
    await suggestions.getByRole('option').first().click();
    await expect(this.page.getByText('Location confirmed.')).toBeVisible();
    await this.clickFramed(this.page.getByRole('button', {name: 'Continue', exact: true}));

    await this.page.getByRole('checkbox', {name: 'Remote', exact: true}).check();
    await this.clickFramed(this.page.getByRole('button', {name: 'Finish setup', exact: true}));
    await expect(this.byTestId('job-search-preferences')).toBeVisible();
  }
}
