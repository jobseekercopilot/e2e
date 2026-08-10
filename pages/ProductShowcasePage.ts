import { expect, type Locator, type Page } from '@playwright/test';
import { demoCursor } from '../support/demo-cursor';
import type { ShowcaseCandidate, ShowcaseEvidence } from '../support/showcase-data';
import { BasePage } from './base.page';

export class ProductShowcasePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async completeProfessionalProfile(candidate: ShowcaseCandidate): Promise<void> {
    const profile = this.page.locator('app-claimant-profile');
    await expect(profile).toBeVisible();
    await this.spotlight(profile);
    await this.pauseAfterFeature();
    await this.clearSpotlight();

    await this.editSkills(profile, candidate.skills);
    await this.editWorkingPreferences(profile);
    await this.editLocationAndCommute(profile, candidate);
    await this.editAvailability(profile, candidate.noticePeriodDays);
    await this.addCareerEvidence(profile, candidate.evidence);

    await expect(profile).toContainText(candidate.skills[0]);
    await expect(profile).toContainText(candidate.targetRoles[0]);
    await expect(profile).toContainText(`${candidate.noticePeriodDays} days' notice`);
    const summary = profile.getByTestId('profile-evidence-summary');
    await expect(summary).toContainText('2 confirmed');
    await expect(summary).toContainText('1 confirmed');
    await this.intentionalScrollNearCenter(summary);
    await this.spotlight(summary);
    await this.pauseAfterFeature();
    await this.clearSpotlight();
  }

  async openSelectedJob(candidate: ShowcaseCandidate): Promise<void> {
    await this.page.goto('/dashboard');
    await this.clickFramed(this.page.getByTestId('workspace-tab-search'));
    const results = this.page.getByTestId('job-result-card');
    const findJobs = this.page.getByRole('button', { name: 'Find jobs', exact: true });
    if (!(await results.first().isVisible().catch(() => false))) {
      await expect(findJobs).toBeEnabled();
      const response = this.page.waitForResponse(candidateResponse =>
        candidateResponse.request().method() === 'POST'
        && new URL(candidateResponse.url()).pathname === '/api/jobs/search');
      await this.clickFramed(findJobs);
      expect((await response).ok(), 'The showcase job search must succeed.').toBeTruthy();
    }
    const card = this.selectedJobCard(candidate);
    await expect(card, `The showcase job ${candidate.selectedJob.title} was not returned.`)
      .toBeVisible({ timeout: 30_000 });
    await this.intentionalScrollNearTop(card, 116);
    await this.spotlight(card);
    await this.pauseAfterFeature();
    const toggle = card.getByRole('button', { name: 'Toggle job details', exact: true });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await this.clickInPlace(toggle);
    }
    await expect(card.getByText(/Job Description|Generate CV|Generate Application/i).first())
      .toBeVisible();
    await this.pauseAfterFeature();
    await this.clearSpotlight();
  }

  async showGenerationOutcome(candidate: ShowcaseCandidate): Promise<void> {
    const card = this.selectedJobCard(candidate);
    await expect(card.getByText(/Documents prepared|generated successfully/i).first())
      .toBeVisible({ timeout: 90_000 });
    await this.intentionalScrollNearTop(card, 116);
    await this.spotlight(card);
    await demoCursor.moveTo(card);
    await this.pauseAfterFeature();
    await demoCursor.park(this.page);
    await this.clearSpotlight();
  }

  async showMeaningfulReporting(): Promise<void> {
    await this.page.goto('/dashboard');
    const reporting = this.page.getByTestId('reporting-panel')
      .or(this.page.locator('app-reporting-panel'));
    await expect(reporting).toBeVisible({ timeout: 30_000 });
    await expect(reporting.getByRole('heading', { name: 'Your job search progress' })).toBeVisible();
    await expect(reporting.getByText('Applications', { exact: true }).first()).toBeVisible();
    await expect(reporting.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
    await this.intentionalScrollNearTop(reporting, 92);
    await this.spotlight(reporting);
    await this.pauseAfterFeature();
    const timeline = reporting.getByTestId('reporting-activity');
    if (await timeline.isVisible().catch(() => false)) {
      await this.intentionalScrollNearCenter(timeline);
      await demoCursor.moveTo(timeline);
      await this.pauseAfterFeature();
    }
    await demoCursor.park(this.page);
    await this.clearSpotlight();
  }

  private async editSkills(profile: Locator, skills: string[]): Promise<void> {
    await this.clickFramed(profile.getByRole('button', { name: 'Edit Skills & expertise', exact: true }));
    const editor = profile.locator('#profile-skills-expertise-editor');
    const input = editor.getByLabel('Skills & expertise', { exact: true });
    for (const skill of skills) {
      await input.fill(skill);
      await input.press('Enter');
    }
    await this.intentionalScrollNearCenter(editor);
    await this.pauseAfterFeature();
    await this.saveProfileSection(profile);
  }

  private async editWorkingPreferences(profile: Locator): Promise<void> {
    await this.clickFramed(profile.getByRole('button', { name: 'Edit Working preferences', exact: true }));
    const editor = profile.locator('#profile-working-preferences-editor');
    for (const label of ['Permanent', 'Full time', 'Flexible', 'Hybrid', 'Remote']) {
      const option = editor.getByLabel(label, { exact: true });
      if (!(await option.isChecked())) await option.check();
    }
    await this.intentionalScrollNearCenter(editor);
    await this.pauseAfterFeature();
    await this.saveProfileSection(profile);
  }

  private async editLocationAndCommute(
    profile: Locator,
    candidate: ShowcaseCandidate
  ): Promise<void> {
    await this.clickFramed(profile.getByRole('button', { name: 'Edit Location and commute', exact: true }));
    const editor = profile.locator('#profile-location-editor');
    await editor.getByLabel('Commute distance', { exact: true })
      .selectOption(String(candidate.commuteDistanceMiles));
    for (const label of ['Driving', 'Public transport']) {
      const option = editor.getByLabel(label, { exact: true });
      if (!(await option.isChecked())) await option.check();
    }
    await editor.getByLabel('Maximum driving time', { exact: true })
      .fill(String(candidate.maximumDrivingMinutes));
    await editor.getByLabel('Maximum public-transport time', { exact: true })
      .fill(String(candidate.maximumTransitMinutes));
    await this.intentionalScrollNearCenter(editor);
    await this.pauseAfterFeature();
    await this.saveProfileSection(profile);
  }

  private async editAvailability(profile: Locator, noticePeriodDays: number): Promise<void> {
    await this.clickFramed(profile.getByRole('button', { name: 'Edit Availability', exact: true }));
    const editor = profile.locator('#profile-availability-editor');
    await editor.getByLabel('Or notice period in days', { exact: true })
      .fill(String(noticePeriodDays));
    await this.intentionalScrollNearCenter(editor);
    await this.pauseAfterFeature();
    await this.saveProfileSection(profile);
  }

  private async saveProfileSection(profile: Locator): Promise<void> {
    const save = profile.getByRole('button', { name: 'Save this section', exact: true });
    const response = this.page.waitForResponse(candidate =>
      candidate.request().method() === 'PATCH'
      && new URL(candidate.url()).pathname === '/api/auth/profile');
    await this.clickFramed(save);
    expect((await response).ok(), 'The showcase profile section must save.').toBeTruthy();
    await expect(save).toBeHidden();
  }

  private async addCareerEvidence(profile: Locator, evidence: ShowcaseEvidence[]): Promise<void> {
    await this.clickFramed(
      profile.getByRole('button', { name: 'Manage experience & achievements', exact: true })
    );
    const dialog = this.page.locator('#experience-evidence-dialog');
    await expect(dialog).toBeVisible();
    const library = dialog.locator('app-evidence-library');
    await library.evaluate(element => {
      element.setAttribute('data-demo-focus', 'app-evidence-library');
      element.setAttribute('data-demo-focus-id', 'evidence-library');
    });
    await this.spotlight(library);
    await this.pauseAfterFeature();
    await this.clearSpotlight();

    for (let index = 0; index < evidence.length; index += 1) {
      await this.addEvidenceEntry(dialog, evidence[index], index === 0);
    }

    const cards = dialog.locator('article.evidence-card');
    await expect(cards).toHaveCount(evidence.length, { timeout: 20_000 });
    await this.intentionalScrollNearCenter(cards.first());
    await this.spotlight(cards.first());
    await this.pauseAfterFeature();
    await this.clearSpotlight();
    await this.clickDialogTarget(
      dialog.getByRole('button', { name: 'Close Experience and Evidence manager', exact: true })
    );
    await expect(dialog).toBeHidden();
  }

  private async addEvidenceEntry(
    dialog: Locator,
    evidence: ShowcaseEvidence,
    showCompletedForm: boolean
  ): Promise<void> {
    await this.clickDialogTarget(
      dialog.getByRole('button', { name: 'Add experience or achievement', exact: true })
    );
    const form = dialog.locator('form');
    await expect(form).toBeVisible();
    await form.locator('select[name="category"]').selectOption(evidence.category);

    await this.fillIfPresent(form.locator('input[name="roleTitle"]'), evidence.roleTitle);
    await this.fillIfPresent(form.locator('input[name="organisation"]'), evidence.organisation);
    await this.fillIfPresent(form.locator('input[name="programme"]'), evidence.programme);
    await this.fillIfPresent(form.locator('input[name="institution"]'), evidence.institution);
    await this.fillIfPresent(form.locator('input[name="qualification"]'), evidence.qualificationTitle);
    await this.fillIfPresent(form.locator('input[name="issuer"]'), evidence.issuer);
    await this.fillIfPresent(form.locator('input[name="heading"]'), evidence.heading);
    await this.fillIfPresent(form.locator('input[name="projectRole"]'), evidence.projectRole);
    await form.locator('textarea[name="description"]').fill(evidence.description);

    if (evidence.category === 'EDUCATION' || evidence.category === 'QUALIFICATION_TRAINING') {
      await form.locator('select[name="completionStatus"]').selectOption('Completed');
      await this.fillIfPresent(form.locator('input[name="completionDate"]'), evidence.issueDate);
    } else {
      await this.fillIfPresent(form.locator('input[name="startDate"]'), evidence.startDate);
      if (evidence.ongoing) {
        await form.locator('input[name="ongoing"]').check();
      } else {
        await this.fillIfPresent(form.locator('input[name="endDate"]'), evidence.endDate);
      }
    }

    await form.getByRole('button', { name: 'Add more detail', exact: true }).click();
    await this.fillIfPresent(form.locator('textarea[name="responsibilities"]'), evidence.responsibilities);
    await this.fillIfPresent(form.locator('textarea[name="achievements"]'), evidence.achievements);
    await form.locator('input[name="skills"]').fill(evidence.demonstratedSkills.join(', '));
    await this.intentionalScrollNearCenter(form.getByRole('button', { name: 'Save as draft', exact: true }));
    if (showCompletedForm) await this.pauseAfterFeature();

    const created = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/auth/evidence');
    await this.clickDialogTarget(form.getByRole('button', { name: 'Save as draft', exact: true }));
    expect((await created).ok(), `Showcase evidence ${evidence.cardText} must save.`).toBeTruthy();

    const card = dialog.locator('article.evidence-card').filter({ hasText: evidence.cardText }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    const confirmed = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && /^\/api\/auth\/evidence\/[^/]+\/confirm$/.test(new URL(response.url()).pathname));
    await this.clickDialogTarget(card.getByRole('button', { name: 'Review & confirm', exact: true }));
    expect((await confirmed).ok(), `Showcase evidence ${evidence.cardText} must confirm.`).toBeTruthy();
    await expect(card.getByText('User confirmed', { exact: true })).toBeVisible();
  }

  private async fillIfPresent(locator: Locator, value: string | undefined): Promise<void> {
    if (value !== undefined && await locator.isVisible().catch(() => false)) {
      await locator.fill(value);
    }
  }

  private async clickDialogTarget(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(420);
    await this.clickInPlace(locator);
  }

  private selectedJobCard(candidate: ShowcaseCandidate): Locator {
    return this.page.getByTestId('job-result-card')
      .filter({ hasText: candidate.selectedJob.title })
      .filter({ hasText: candidate.selectedJob.company })
      .first();
  }
}
