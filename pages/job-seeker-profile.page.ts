import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';
import type { DemoUser } from '../support/world';

export class JobSeekerProfilePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async confirmProfileCompleted(user: DemoUser): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Claimant Profile', exact: true })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: user.fullName })).toBeVisible();
    await expect(this.page.getByText(user.email)).toBeVisible();
  }

  async updateHomeLocation(postcode: string): Promise<void> {
    await this.page.getByRole('button', { name: /^edit$/i }).click();
    const input = this.byTestId('profile-home-location-input');
    await input.fill(postcode);
    const suggestions = this.byTestId('profile-location-suggestions');
    await expect(suggestions).toBeVisible();
    await suggestions.getByRole('button').first().click();
    await this.page.getByRole('button', { name: /save profile/i }).click();
  }

  async expectHomeLocation(location: string): Promise<void> {
    await expect(this.page.getByText(location, { exact: false })).toBeVisible();
  }
}
