import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class JobDetailsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async waitForDetails(): Promise<void> {
    // TODO frontend: add data-testid="job-details-panel".
    await expect(
      this.byTestId('job-details-panel')
        .or(this.page.getByRole('heading', { name: /job description/i }))
        .or(this.page.getByText(/Job Description|View on|Generate CV/i))
        .first()
    ).toBeVisible();
    await this.pauseBeforeFeature();
  }

  async expectGenerationActionsIfAvailable(): Promise<boolean> {
    // Current UI has a combined button. TODO split/add data-testid values:
    // generate-cv-button and generate-cover-letter-button.
    const action = this.byTestId('generate-cv-button')
      .or(this.byTestId('generate-cover-letter-button'))
      .or(this.byTestId('generate-documents-button'))
      .or(this.page.getByRole('button', { name: /generate cv|generate cover letter|generate cv & cover letter/i }));

    const visible = await action.first().isVisible().catch(() => false);
    if (visible) {
      await this.spotlight(action.first());
      await this.pauseAfterFeature();
      await this.clearSpotlight();
    }

    return visible;
  }
}
