import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export interface JobSearchFixture {
  keywords: string;
  location: string;
  fallbackLocation: string;
  targetRole: string;
}

export class JobSearchPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/');
    await this.clickFramed(
      this.byTestId('workspace-tab-search')
        .or(this.page.getByRole('button', { name: /search results|find new opportunities/i }))
        .first()
    );
    await expect(this.byTestId('job-results-workspace').or(this.page.getByRole('heading', { name: /job matches/i })).first()).toBeVisible();
  }

  async searchForSoftwareDeveloperJobs(search: JobSearchFixture): Promise<void> {
    // The current product usually pre-populates matches from profile target roles.
    // Fallback supports older dashboard search form if it is rendered.
    const desiredRoles = this.byTestId('job-search-keywords-input')
      .or(this.page.getByLabel(/desired roles/i));

    if (await desiredRoles.first().isVisible().catch(() => false)) {
      await this.humanFill(desiredRoles.first(), search.keywords);
      const location = this.byTestId('job-search-location-input').or(this.page.getByLabel(/locations/i));
      if (await location.first().isVisible().catch(() => false)) {
        await this.humanFill(location.first(), search.location);
      }
      await this.clickCentered(this.byTestId('job-search-submit-button')
        .or(this.page.getByRole('button', { name: /search jobs|find jobs/i }))
        .first());
    }

    await this.waitForResults();
    await this.pauseBeforeFeature();
  }

  async waitForResults(): Promise<void> {
    await expect(
      this.byTestId('job-result-card')
        .or(this.page.locator('app-job-card'))
        .or(this.page.getByText(/Software Developer|Software Engineer|Job Matches/i))
        .first()
    ).toBeVisible({ timeout: 30_000 });
  }

  async openFirstRelevantJob(): Promise<void> {
    await this.waitForResults();
    const selectedJob = await this.curatedJobCard();

    if (await selectedJob.isVisible().catch(() => false)) {
      await this.intentionalScrollNearTop(selectedJob, 118);
      await this.spotlight(selectedJob);
      await this.clickInPlace(selectedJob.getByRole('button', { name: /toggle job details/i }).first());
      await expect(selectedJob.getByText(/Job Description|View on|Generate CV|Generate Application/i).first()).toBeVisible();
      await this.pauseAfterFeature();
      await this.clearSpotlight();
      return;
    }

    // TODO frontend: add data-testid="job-result-title".
    await this.clickFramed(this.page.getByRole('button', { name: /software developer|software engineer/i }).first());
  }

  async smoothScrollResults(): Promise<void> {
    const results = this.byTestId('job-result-card').or(this.page.locator('app-job-card'));
    const count = await results.count();

    if (count > 3) {
      await this.intentionalScrollNearCenter(results.nth(Math.min(3, count - 1)));
      await this.pauseAfterFeature();
    }
  }

  private async curatedJobCard() {
    const cards = this.byTestId('job-result-card').or(this.page.locator('app-job-card'));
    const curated = cards.filter({ hasText: /Product Software Developer|Northstar Digital|Full Stack JavaScript Developer|Python Software Developer|Junior Application Software Engineer/i });
    const curatedVisible = await this.visibleLocator(curated);
    if (curatedVisible) {
      return curatedVisible;
    }

    const visibleCard = await this.visibleLocator(cards, 2);
    if (visibleCard) {
      return visibleCard;
    }
    const count = await cards.count();
    return cards.nth(Math.max(0, Math.min(Math.floor(count / 2), count - 1)));
  }

  private async visibleLocator(locator: Locator, preferredIndex = 0): Promise<Locator | undefined> {
    const visible = [];
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
