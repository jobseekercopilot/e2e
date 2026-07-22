import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class NavigationPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goToDashboard(): Promise<void> {
    // TODO frontend: add data-testid="nav-dashboard".
    await this.page.goto('/dashboard');
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  async goToFindJobs(): Promise<void> {
    await this.goToDashboard();
    await this.clickFramed(
      this.byTestId('workspace-tab-search')
        .or(this.page.getByRole('button', { name: /search results|find new opportunities/i }))
        .first()
    );
    await expect(this.byTestId('workspace-panel-search')).toBeVisible();
  }

  async goToApplications(): Promise<void> {
    await this.goToDashboard();
    await this.clickFramed(
      this.byTestId('workspace-tab-applications')
        .or(this.page.getByRole('button', { name: /my applications|track and manage/i }))
        .first()
    );
    await expect(this.byTestId('workspace-panel-applications')).toBeVisible();
  }

  async goToDocuments(): Promise<void> {
    await this.goToDashboard();
    await this.clickFramed(
      this.byTestId('workspace-tab-documents')
        .or(this.page.getByRole('button', { name: /documents|your cvs and cover letters/i }))
        .first()
    );
    await expect(this.byTestId('workspace-panel-documents')).toBeVisible();
  }

  async goToAiCredit(): Promise<void> {
    // TODO frontend: add data-testid="nav-ai-credit".
    await this.goToDashboard();
    const target = this.byTestId('ai-credit-page')
      .or(this.byTestId('dashboard-ai-credit-widget'))
      .or(this.page.getByText(/AI Credit/i).first());
    await this.intentionalScrollNearCenter(target.first());
  }
}
