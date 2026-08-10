import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class ApplicationTrackerPage extends BasePage {
  private lastChangedApplication?: {
    title: string;
    company: string;
    status: 'interview' | 'offer';
  };

  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.clickFramed(
      this.byTestId('workspace-tab-applications')
        .or(this.page.getByRole('button', { name: /my applications|track and manage/i }))
        .first()
    );
    await expect(this.byTestId('applications-workspace').or(this.page.getByText(/No applications in this view|Application status filters/i)).first()).toBeVisible();
  }

  async waitForApplications(): Promise<void> {
    const cards = this.applicationCards();
    await expect(cards.first(), 'Application fixture did not render any application card.')
      .toBeVisible({ timeout: 20_000 });
    const focusCard = await this.requireVisibleLocator(
      cards,
      'Application fixture rendered no visible application card.',
      1
    );
    await this.spotlight(focusCard);
    await this.pauseBeforeFeature();
    await this.clearSpotlight();
  }

  async expectSpecialistApplications(): Promise<void> {
    await expect(
      this.applicationCardFor('Community Staff Nurse', 'Example NHS Foundation Trust')
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      this.applicationCardFor('Software Developer Apprentice', 'Example Digital Ltd')
    ).toBeVisible({ timeout: 20_000 });
  }

  async changeFirstApplicationStatus(status: 'Applied' | 'Interview' | 'Offer'): Promise<void> {
    await (status === 'Offer'
      ? this.moveInterviewApplicationToOffer()
      : this.moveApplicationToInterview());
  }

  async moveApplicationToInterview(): Promise<void> {
    await this.updateApplicationStatus(['applied'], /Interview/i, 'interview');
  }

  async moveInterviewApplicationToOffer(): Promise<void> {
    await this.updateApplicationStatus(['interview'], /Offer/i, 'offer');
  }

  async focusApplicationWithStatus(status: RegExp): Promise<void> {
    const knownStatus = this.statusSlug(status);
    const card = knownStatus
      ? await this.cardWithCurrentStatus([knownStatus])
      : await this.cardWithStatus(status);
    await expect(card, `No visible application matched ${status}.`)
      .toBeVisible({ timeout: 20_000 });
    await this.spotlight(card);
    await this.pauseAfterFeature();
    await this.clearSpotlight();
  }

  async expectLastChangedStatusAfterRefresh(
    expectedStatus: 'interview' | 'offer'
  ): Promise<void> {
    const changed = this.lastChangedApplication;
    if (!changed || changed.status !== expectedStatus) {
      throw new Error(`No application was changed to ${expectedStatus} in this scenario.`);
    }

    const refresh = this.byTestId('applications-workspace')
      .getByRole('button', { name: 'Refresh', exact: true });
    await expect(refresh, 'Application refresh control is missing.').toBeVisible();
    const refreshedApplications = this.page.waitForResponse(
      response => response.request().method() === 'GET'
        && new URL(response.url()).pathname === '/api/jobs/applications',
      { timeout: 20_000 }
    );
    await this.clickFramed(refresh);
    const response = await refreshedApplications;
    if (!response.ok()) {
      throw new Error(`Application refresh failed with HTTP ${response.status()}.`);
    }

    const persisted = this.applicationCardFor(changed.title, changed.company);
    await expect(
      persisted.locator(`.status-${expectedStatus}`).first(),
      `Application status ${expectedStatus} did not persist after refresh.`
    ).toBeVisible({ timeout: 20_000 });
  }

  private async updateApplicationStatus(
    currentStatuses: string[],
    actionName: RegExp,
    completedStatus: 'interview' | 'offer'
  ): Promise<void> {
    const card = await this.cardWithCurrentStatus(currentStatuses);
    await expect(
      card,
      `No visible application had an allowed starting status: ${currentStatuses.join(', ')}.`
    ).toBeVisible({ timeout: 20_000 });

    await this.spotlight(card);
    await this.pauseBeforeFeature();
    const title = (await card.locator('h3').first().innerText()).trim();
    const company = (await card.locator('.application-meta span').first().innerText()).trim();

    const summary = card.locator('summary').filter({ hasText: /View Application/i }).first();
    if (await summary.isVisible().catch(() => false)) {
      await this.clickFramed(summary);
    }

    const action = card.getByRole('button', { name: actionName }).first();
    if (await action.count() === 0) {
      await this.clearSpotlight();
      throw new Error(
        `Application action ${actionName} is missing for ${title} at ${company}.`
      );
    }
    await expect(
      action,
      `Application action ${actionName} is missing for ${title} at ${company}.`
    ).toBeVisible();

    await this.clickFramed(action);
    const updatedCard = this.applicationCardFor(title, company);
    await expect(updatedCard.locator(`.status-${completedStatus}`).first()).toBeVisible({ timeout: 20_000 });
    await this.spotlight(updatedCard);
    await this.pauseAfterFeature();
    await this.clearSpotlight();
    this.lastChangedApplication = {
      title,
      company,
      status: completedStatus
    };
  }

  private async cardWithStatus(status: RegExp) {
    const cards = this.applicationCards();
    await expect(
      cards.first(),
      'Application fixture did not render any application card.'
    ).toBeVisible({ timeout: 20_000 });
    const matching = cards.filter({ hasText: status });
    return this.requireVisibleLocator(
      matching,
      `No visible application matched status ${status}.`,
      1
    );
  }

  private async cardWithCurrentStatus(statuses: string[]) {
    const cards = this.applicationCards();
    await expect(
      cards.first(),
      'Application fixture did not render any application card.'
    ).toBeVisible({ timeout: 20_000 });
    for (const status of statuses) {
      const matching = cards.filter({ has: this.page.locator(`.status-${status}`) });
      const visibleMatching = await this.visibleLocator(matching, 1);
      if (visibleMatching) {
        return visibleMatching;
      }
    }

    throw new Error(
      `No visible application matched an allowed current status: ${statuses.join(', ')}.`
    );
  }

  private applicationCards() {
    return this.byTestId('application-card').or(this.page.locator('.application-card'));
  }

  private applicationCardFor(title: string, company: string) {
    return this.applicationCards().filter({ hasText: title }).filter({ hasText: company }).first();
  }

  private statusSlug(status: RegExp): string | undefined {
    const source = status.source.toLowerCase();
    if (source.includes('interview')) {
      return 'interview';
    }
    if (source.includes('offer')) {
      return 'offer';
    }
    if (source.includes('applied')) {
      return 'applied';
    }
    return undefined;
  }

  private async visibleLocator(locator: Locator, preferredIndex = 0): Promise<Locator | undefined> {
    const visible: Locator[] = [];
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) {
        visible.push(item);
      }
    }
    if (visible.length === 0) return undefined;
    return visible[Math.min(preferredIndex, visible.length - 1)];
  }

  private async requireVisibleLocator(
    locator: Locator,
    message: string,
    preferredIndex = 0
  ): Promise<Locator> {
    const visible = await this.visibleLocator(locator, preferredIndex);
    if (!visible) {
      throw new Error(message);
    }
    return visible;
  }
}
