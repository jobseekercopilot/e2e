import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';
import { e2eConfig } from '../support/config';
import type { DemoUser } from '../support/world';

export class RegisterPage extends BasePage {
  constructor(page: Page, private readonly baseUrl: string) {
    super(page);
  }

  async open(): Promise<void> {
    await this.page.goto(this.baseUrl);
    await expect(this.page).toHaveURL(/\/dashboard|\/$/);
    await this.page.addStyleTag({
      content: 'html, body, * { overflow-anchor: none !important; }'
    });
    await this.page.waitForTimeout(e2eConfig.demoBufferMs);
  }

  async registerUser(user: DemoUser): Promise<void> {
    await this.startCreateProfile();
    await this.enterAccountDetails(user);
    await this.submitRegistration();
    await this.completeSearchSetup(user);
  }

  /**
   * Mirrors {@link registerUser} but drives the extended onboarding path:
   * after account creation it runs {@link completeSearchSetupWithEvidence},
   * which completes preferences (steps 1–3), adds one qualification (step 4)
   * and one employment entry (step 5), then skips volunteering (step 6) to
   * reach the dashboard. Kept minimal to preserve the page-object contract.
   */
  async registerUserWithEvidence(user: DemoUser): Promise<void> {
    await this.startCreateProfile();
    await this.enterAccountDetails(user);
    await this.submitRegistration();
    await this.completeSearchSetupWithEvidence(user);
  }

  async loginUser(user: DemoUser): Promise<void> {
    await this.page.goto(this.baseUrl);
    await this.page.addStyleTag({
      content: 'html, body, * { overflow-anchor: none !important; }'
    });
    await this.clickFramed(
      this.byTestId('sign-in-tab')
        .or(this.page.locator('#tab-btn-signin'))
        .or(this.page.getByRole('tab', { name: /sign in/i }))
        .or(this.page.getByRole('button', { name: /sign in/i }))
    );
    await this.humanFillInPlace(this.page.getByLabel(/email address/i), user.email);
    await this.humanFillInPlace(this.page.getByLabel(/^password$/i), user.password);
    const responsePromise = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && response.url().includes('/api/auth/login')
    );
    await this.clickCentered(
      this.byTestId('submit-sign-in-button')
        .or(this.page.locator('#btn-submit-signin'))
        .or(this.page.getByRole('button', { name: 'Sign in', exact: true }))
        .first()
    );
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`Sign in failed with HTTP ${response.status()}.`);
    }
    await expect(this.byTestId('job-search-preferences')).toBeVisible();
  }

  private async startCreateProfile(): Promise<void> {
    const createProfileTab = this.byTestId('create-profile-tab')
      .or(this.page.locator('#tab-btn-create'))
      .or(this.page.getByRole('tab', { name: /create profile/i }))
      .or(this.page.getByRole('button', { name: /create profile/i }));
    await this.clickFramed(createProfileTab);
  }

  private async enterAccountDetails(user: DemoUser): Promise<void> {
    await this.humanFillFramed(this.page.getByLabel(/full name/i), user.fullName);
    await this.humanFillFramed(this.page.getByLabel(/email address/i), user.email);
    await this.humanFillFramed(this.page.getByLabel(/^password$/i), user.password);
    const legalAcknowledgement = this.page.getByRole('checkbox', {
      name: /aged 18 or over, accept the terms of use and acknowledge the privacy notice/i,
    });
    await expect(legalAcknowledgement).toBeVisible();
    await legalAcknowledgement.check();
  }

  private async submitRegistration(): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && response.url().includes('/api/auth/register')
    );
    await this.clickFramed(
      this.byTestId('submit-registration-button')
        .or(this.page.locator('#btn-submit-signup'))
    );
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(
        `Registration failed with HTTP ${response.status()}: ${await response.text()}`
      );
    }
    await expect(
      this.page.getByRole('heading', {name: 'Let’s find the right opportunities', exact: true})
    ).toBeVisible();
  }

  private async completeSearchSetup(user: DemoUser): Promise<void> {
    await this.completePreferenceSteps(user);

    // Since the onboarding flow gained three optional steps (Qualifications,
    // Employment, Volunteering), "Finish setup" now lands on step 4 rather than
    // the dashboard. Skipping at step 4 emits `onboarded` immediately, which
    // completes onboarding and reaches the dashboard.
    await this.skipRemainingEvidenceSteps();
    await expect(this.byTestId('job-search-preferences')).toBeVisible();
  }

  /**
   * Completes onboarding steps 1–3 exactly like {@link completeSearchSetup},
   * then adds one qualification (step 4) and one employment entry (step 5),
   * asserting each save issues a successful `POST /api/auth/evidence`, before
   * skipping volunteering (step 6) to land on the dashboard.
   */
  async completeSearchSetupWithEvidence(user: DemoUser): Promise<void> {
    await this.completePreferenceSteps(user);

    await this.addQualificationEntry(user);
    await this.clickFramed(this.page.getByRole('button', {name: 'Continue', exact: true}));

    await this.addEmploymentEntry(user);
    await this.clickFramed(this.page.getByRole('button', {name: 'Continue', exact: true}));

    // Skip volunteering (step 6) — this emits `onboarded` and lands on the dashboard.
    await this.skipRemainingEvidenceSteps();
    await expect(this.byTestId('job-search-preferences')).toBeVisible();
  }

  /**
   * Completes preference steps 1–3 (target roles, location, workplace) and
   * clicks "Finish setup", leaving the user on step 4 (Qualifications).
   */
  private async completePreferenceSteps(user: DemoUser): Promise<void> {
    await this.humanFillFramed(
      this.page.getByLabel('Target roles', {exact: true}),
      user.targetRoles.join(', '),
    );
    await this.clickFramed(this.page.getByRole('button', {name: 'Continue', exact: true}));

    await this.humanFillFramed(
      this.page.getByLabel('Search postcode', {exact: true}),
      user.homeLocation,
    );
    const suggestions = this.page.getByRole('listbox', {name: 'Matching UK locations'});
    await expect(suggestions).toBeVisible();
    await suggestions.getByRole('option').first().click();
    await expect(this.page.getByText('Location confirmed.')).toBeVisible();
    await this.clickFramed(this.page.getByRole('button', {name: 'Continue', exact: true}));

    await this.page.getByRole('checkbox', {name: 'Remote', exact: true}).check();
    await this.clickFramed(this.page.getByRole('button', {name: 'Finish setup', exact: true}));
  }

  /**
   * Fills and saves a single qualification entry on step 4. The embedded
   * evidence library form saves each entry via `POST /api/auth/evidence`; this
   * asserts the response is HTTP 2xx.
   */
  private async addQualificationEntry(user: DemoUser): Promise<void> {
    await this.humanFillFramed(
      this.page.getByLabel('Qualification or training title', {exact: true}),
      user.qualification.name,
    );
    await this.humanFillFramed(
      this.page.getByLabel('Awarding or issuing body', {exact: true}),
      user.qualification.institution,
    );
    await this.selectFramed(
      this.page.getByLabel('Status', {exact: true}),
      'Completed',
    );
    await this.fillFramed(
      this.page.getByLabel('Completion date', {exact: true}),
      this.toDateInput(user.qualification.completed),
    );
    await this.saveEvidenceDraft();
  }

  /**
   * Fills and saves a single employment entry on step 5. "This is ongoing or
   * current" is ticked to avoid requiring an end date. Asserts the save issues
   * a successful `POST /api/auth/evidence`.
   */
  private async addEmploymentEntry(user: DemoUser): Promise<void> {
    const job = user.workHistory[0];
    await this.humanFillFramed(
      this.page.getByLabel('Role', {exact: true}),
      job.jobTitle,
    );
    await this.humanFillFramed(
      this.page.getByLabel('Employer', {exact: true}),
      job.employer,
    );
    await this.fillFramed(
      this.page.getByLabel('Start date', {exact: true}),
      this.toDateInput(job.from),
    );
    await this.page.getByRole('checkbox', {name: 'This is ongoing or current', exact: true}).check();
    await this.saveEvidenceDraft();
  }

  /**
   * Clicks "Save as draft" inside the embedded evidence library and waits for
   * the corresponding `POST /api/auth/evidence` call to succeed. The evidence
   * create endpoint is `POST /api/auth/evidence` (see the generated
   * EvidenceLibraryService), so the URL predicate matches on `/evidence`.
   */
  private async saveEvidenceDraft(): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && /\/evidence(?:$|\?)/.test(new URL(response.url()).pathname)
    );
    await this.clickFramed(this.page.getByRole('button', {name: 'Save as draft', exact: true}));
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(
        `Saving evidence failed with HTTP ${response.status()}: ${await response.text()}`
      );
    }
  }

  /**
   * Clicks the "Skip" button available on evidence steps 4/5/6. Skipping emits
   * `onboarded` immediately, completing onboarding and landing on the dashboard.
   */
  private async skipRemainingEvidenceSteps(): Promise<void> {
    await this.clickFramed(this.page.getByRole('button', {name: 'Skip', exact: true}));
  }

  /**
   * Normalises a fixture date to the `yyyy-mm-dd` value expected by
   * `<input type="date">`. Fixture dates may already be ISO-formatted or a year
   * such as "2019"; anything unparseable falls back to a stable default.
   */
  private toDateInput(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    if (/^\d{4}$/.test(value)) {
      return `${value}-01-01`;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return '2020-01-01';
  }
}
