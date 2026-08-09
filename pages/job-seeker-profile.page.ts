import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';
import type { DemoUser } from '../support/world';

export class JobSeekerProfilePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async confirmProfileCompleted(user: DemoUser): Promise<void> {
    await expect(this.byTestId('job-search-preferences')).toBeVisible();
    await expect(this.page.getByRole('heading', { name: user.fullName })).toBeVisible();
    await expect(this.page.getByText(user.email)).toBeVisible();
  }

  async updateHomeLocation(postcode: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Edit Location and commute', exact: true }).click();
    const input = this.page.getByLabel('Town or postcode', { exact: true });
    await input.fill(postcode);
    const suggestions = this.page.getByRole('listbox', { name: 'Matching UK locations' });
    await expect(suggestions).toBeVisible();
    await suggestions.getByRole('option').first().click();
    await expect(this.page.getByText('Confirming location…')).toBeHidden();
    await this.page.getByRole('button', { name: 'Save this section', exact: true }).click();
    await expect(this.page.getByRole('button', { name: 'Save this section', exact: true })).toBeHidden();
  }

  async expectHomeLocation(location: string): Promise<void> {
    await expect(this.page.getByText(location, { exact: false })).toBeVisible();
  }
}
