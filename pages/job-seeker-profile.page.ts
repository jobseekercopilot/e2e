import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';
import type { DemoUser } from '../support/world';

export class JobSeekerProfilePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async confirmProfileCompleted(user: DemoUser): Promise<void> {
    // TODO frontend: add data-testid="claimant-profile-card" to the profile card.
    await expect(this.byTestId('claimant-profile-card').or(this.page.getByText(/claimant profile/i))).toBeVisible();
    await expect(this.page.getByRole('heading', { name: user.fullName })).toBeVisible();
    await expect(this.page.getByText(user.email)).toBeVisible();
  }
}
