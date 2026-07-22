import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class ApplicationTrackerPage extends BasePage {
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

  async waitForApplications(): Promise<boolean> {
    const card = this.byTestId('application-card').or(this.page.getByText(/No applications in this view|Applied|Interview|Offer/i).first());
    const visible = await card.first().isVisible().catch(() => false);
    if (visible) {
      const focusCard = await this.visibleLocator(this.applicationCards(), 1);
      if (focusCard) await this.spotlight(focusCard);
      await this.pauseBeforeFeature();
      await this.clearSpotlight();
    }
    return visible;
  }

  async changeFirstApplicationStatus(status: 'Applied' | 'Interview' | 'Offer'): Promise<boolean> {
    return status === 'Offer'
      ? this.moveInterviewApplicationToOffer()
      : this.moveApplicationToInterview();
  }

  async moveApplicationToInterview(): Promise<boolean> {
    return this.updateApplicationStatus(['documents-generated', 'applied'], /Interview/i, 'interview');
  }

  async moveInterviewApplicationToOffer(): Promise<boolean> {
    return this.updateApplicationStatus(['interview'], /Offer/i, 'offer');
  }

  async focusApplicationWithStatus(status: RegExp): Promise<boolean> {
    const knownStatus = this.statusSlug(status);
    const card = knownStatus
      ? await this.cardWithCurrentStatus([knownStatus])
      : await this.cardWithStatus(status);
    if (!(await card.isVisible().catch(() => false))) {
      return false;
    }
    await this.spotlight(card);
    await this.pauseAfterFeature();
    await this.clearSpotlight();
    return true;
  }

  private async updateApplicationStatus(currentStatuses: string[], actionName: RegExp, completedStatus: string): Promise<boolean> {
    const card = await this.cardWithCurrentStatus(currentStatuses);
    if (!(await card.isVisible().catch(() => false))) {
      return false;
    }

    await this.spotlight(card);
    await this.pauseBeforeFeature();
    const title = (await card.locator('h3').first().innerText()).trim();
    const company = (await card.locator('.application-meta span').first().innerText()).trim();

    const summary = card.locator('summary').filter({ hasText: /View Application/i }).first();
    if (await summary.isVisible().catch(() => false)) {
      await this.clickFramed(summary);
    }

    const action = card.getByRole('button', { name: actionName }).first();
    if (!(await action.isVisible().catch(() => false))) {
      await this.clearSpotlight();
      return false;
    }

    await this.clickFramed(action);
    const updatedCard = this.applicationCardFor(title, company);
    await expect(updatedCard.locator(`.status-${completedStatus}`).first()).toBeVisible({ timeout: 20_000 });
    await this.spotlight(updatedCard);
    await this.pauseAfterFeature();
    await this.clearSpotlight();
    return true;
  }

  private async cardWithStatus(status: RegExp) {
    const cards = this.applicationCards();
    const matching = cards.filter({ hasText: status });
    const visibleMatching = await this.visibleLocator(matching, 1);
    if (visibleMatching) {
      return visibleMatching;
    }

    return await this.visibleLocator(cards, 1) ?? cards.first();
  }

  private async cardWithCurrentStatus(statuses: string[]) {
    const cards = this.applicationCards();
    for (const status of statuses) {
      const matching = cards.filter({ has: this.page.locator(`.status-${status}`) });
      const visibleMatching = await this.visibleLocator(matching, 1);
      if (visibleMatching) {
        return visibleMatching;
      }
    }

    return await this.visibleLocator(cards, 1) ?? cards.first();
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
}
