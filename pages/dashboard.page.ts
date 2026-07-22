import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectLoaded(): Promise<void> {
    // TODO frontend: add data-testid="job-seeker-dashboard" to the dashboard container.
    await expect(this.byTestId('job-seeker-dashboard').or(this.page.getByRole('heading', { name: /job matches/i }))).toBeVisible();
    await expect(this.page.getByRole('heading', { name: /claimant profile/i })).toBeVisible();
  }
}
