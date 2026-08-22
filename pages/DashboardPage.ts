import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';
import { e2eConfig } from '../support/config';

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async waitForDashboard(): Promise<void> {
    // The current dashboard exposes stable workspace-tab test IDs rather than a
    // dashboard-root test ID. Keep the legacy fallbacks for older deployments.
    await expect(
      this.byTestId('dashboard-page')
        .or(this.byTestId('workspace-tab-search'))
        .or(this.page.getByRole('heading', { name: /job matches|job seeker dashboard/i }))
        .or(this.page.getByRole('heading', { name: /claimant profile/i }))
        .first()
    ).toBeVisible();
  }

  async pauseForReveal(): Promise<void> {
    await this.waitForDashboard();
    await this.page.waitForTimeout(e2eConfig.demoBufferMs);
  }

  async showActivityTimeline(): Promise<boolean> {
    // TODO frontend: add data-testid="dashboard-activity-timeline".
    const activity = this.byTestId('dashboard-activity-timeline')
      .or(this.page.getByRole('heading', { name: /recent activity|activity/i }))
      .or(this.page.getByText(/no activity yet|generated|applied|interview|offer/i));

    if (await activity.first().isVisible().catch(() => false)) {
      await this.intentionalScrollNearCenter(activity.first());
      await this.page.waitForTimeout(e2eConfig.demoBufferMs);
      return true;
    }

    return false;
  }

  async waitForDashboardWidgets(): Promise<void> {
    await this.waitForDashboard();

    // TODO frontend: add data-testid values for dashboard-ai-credit-widget,
    // dashboard-application-stats and dashboard-document-stats.
    await expect(
      this.page.getByText(/Document credits|Applications|Documents|Job Matches|Claimant Profile/i).first()
    ).toBeVisible();
  }

  async expectLoaded(): Promise<void> {
    await this.waitForDashboard();
  }
}
