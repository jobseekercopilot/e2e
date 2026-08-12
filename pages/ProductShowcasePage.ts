import { expect, type Locator, type Page } from '@playwright/test';
import { e2eConfig } from '../support/config';
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
    await this.expectEvidenceSummary(summary);
    await this.intentionalScrollNearCenter(summary);
    await this.spotlight(summary);
    await this.pauseAfterFeature();
    await this.clearSpotlight();
  }

  async expectProfessionalProfilePersisted(candidate: ShowcaseCandidate): Promise<void> {
    await this.page.goto('/dashboard');
    const profile = this.page.locator('app-claimant-profile');
    await expect(profile).toBeVisible({timeout: 30_000});
    await expect(profile).toContainText(candidate.skills[0]);
    await expect(profile).toContainText(candidate.targetRoles[0]);
    await expect(profile).toContainText(`${candidate.noticePeriodDays} days' notice`);
    const summary = profile.getByTestId('profile-evidence-summary');
    await this.expectEvidenceSummary(summary);
  }

  private async expectEvidenceSummary(summary: Locator): Promise<void> {
    const row = (label: string) => summary.locator('.evidence-summary-row').filter({hasText: label});
    await this.expectConfirmedAtLeast(row('Work experience'), 'Work experience', 2);
    await this.expectConfirmedAtLeast(row('Qualifications'), 'Qualifications', 2);
    await this.expectConfirmedAtLeast(row('Projects and achievements'), 'Projects and achievements', 1);
  }

  private async expectConfirmedAtLeast(row: Locator, label: string, minimum: number): Promise<void> {
    await expect(row).toBeVisible();
    const count = Number((await row.textContent())?.match(/(\d+) confirmed/)?.[1] ?? -1);
    expect(count, `${label} must retain at least ${minimum} confirmed entries`).toBeGreaterThanOrEqual(minimum);
  }

  async openSelectedJob(candidate: ShowcaseCandidate, alreadyTracked = false): Promise<void> {
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
    const card = this.configuredShowcaseJobCard(candidate, results);
    await expect(card, 'No suitable showcase job was returned.')
      .toBeVisible({ timeout: 30_000 });
    if (e2eConfig.allowRealProviderE2e) {
      await expect(this.page.getByText('Real providers', { exact: true }).first()).toBeVisible();
      await this.captureLiveJobIdentity(card, candidate);
    }
    await this.intentionalScrollNearTop(card, 116);
    await this.spotlight(card);
    await this.pauseAfterFeature();
    const toggle = card.getByRole('button', { name: 'Toggle job details', exact: true });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await this.clickInPlace(toggle);
    }
    await expect(card.getByText(/Job Description|Generate CV|Generate Application/i).first())
      .toBeVisible();
    if (e2eConfig.allowRealProviderE2e && !alreadyTracked) {
      await expect(card.getByTestId('track-application-button')).toBeEnabled();
      await expect(card.getByTestId('generate-documents-button')).toBeEnabled();
    }
    const readFullAdvert = card.getByRole('button', { name: 'Read full advert', exact: true });
    if (e2eConfig.allowRealProviderE2e && await readFullAdvert.isVisible().catch(() => false)) {
      await this.clickInPlace(readFullAdvert);
      const showLess = card.getByRole('button', { name: 'Show less', exact: true });
      await expect(showLess)
        .toBeVisible({ timeout: 60_000 });
      await this.pauseAfterFeature();
      await this.clickFramed(showLess);
    }
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

  async expectSelectedJobStatus(candidate: ShowcaseCandidate, expected: string): Promise<void> {
    const card = this.selectedJobCard(candidate);
    const badge = card.locator('.status-badge').filter({ hasText: expected }).first();
    await expect(
      badge,
      `The selected search result must reconcile to application status ${expected}.`,
    ).toBeVisible({ timeout: 30_000 });
    await this.intentionalScrollNearTop(card.locator('.job-card-trigger'), 116);
    await demoCursor.moveTo(badge);
    await this.pauseAfterFeature();
  }

  async verifyLiveShowcaseRuntime(): Promise<void> {
    if (!e2eConfig.allowRealProviderE2e) return;
    await this.clickFramed(this.page.getByTestId('workspace-tab-documents'));
    await expect(this.page.getByText('Real OpenAI generation', { exact: true })).toBeVisible();
    await this.clickFramed(this.page.getByTestId('workspace-tab-search'));
    await expect(this.page.getByText('Real providers', { exact: true }).first()).toBeVisible();
  }

  async showMeaningfulReporting(): Promise<void> {
    await this.page.goto('/dashboard');
    const reporting = this.page.getByTestId('reporting-panel')
      .or(this.page.locator('app-reporting-panel'))
      .first();
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
      await this.humanFillInPlace(input, skill);
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
      if (!(await option.isChecked())) await this.clickFramed(option);
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
    await this.selectFramed(
      editor.getByLabel('Commute distance', { exact: true }),
      String(candidate.commuteDistanceMiles)
    );
    for (const label of ['Driving', 'Public transport']) {
      const option = editor.getByLabel(label, { exact: true });
      if (!(await option.isChecked())) await this.clickFramed(option);
    }
    await this.humanFillFramed(
      editor.getByLabel('Maximum driving time', { exact: true }),
      String(candidate.maximumDrivingMinutes)
    );
    await this.humanFillFramed(
      editor.getByLabel('Maximum public-transport time', { exact: true }),
      String(candidate.maximumTransitMinutes)
    );
    await this.intentionalScrollNearCenter(editor);
    await this.pauseAfterFeature();
    await this.saveProfileSection(profile);
  }

  private async editAvailability(profile: Locator, noticePeriodDays: number): Promise<void> {
    await this.clickFramed(profile.getByRole('button', { name: 'Edit Availability', exact: true }));
    const editor = profile.locator('#profile-availability-editor');
    await this.humanFillFramed(
      editor.getByLabel('Or notice period in days', { exact: true }),
      String(noticePeriodDays)
    );
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
    await this.selectDialogTarget(form.locator('select[name="category"]'), evidence.category);

    await this.humanFillIfPresent(form.locator('input[name="roleTitle"]'), evidence.roleTitle);
    await this.humanFillIfPresent(form.locator('input[name="organisation"]'), evidence.organisation);
    await this.humanFillIfPresent(form.locator('input[name="programme"]'), evidence.programme);
    await this.humanFillIfPresent(form.locator('input[name="institution"]'), evidence.institution);
    await this.humanFillIfPresent(form.locator('input[name="qualification"]'), evidence.qualificationTitle);
    await this.humanFillIfPresent(form.locator('input[name="issuer"]'), evidence.issuer);
    await this.humanFillIfPresent(form.locator('input[name="heading"]'), evidence.heading);
    await this.humanFillIfPresent(form.locator('input[name="projectRole"]'), evidence.projectRole);
    await this.humanFillDialogTarget(form.locator('textarea[name="description"]'), evidence.description);

    if (evidence.category === 'EDUCATION' || evidence.category === 'QUALIFICATION_TRAINING') {
      await this.selectDialogTarget(form.locator('select[name="completionStatus"]'), 'Completed');
      await this.fillIfPresent(form.locator('input[name="completionDate"]'), evidence.issueDate);
    } else {
      await this.fillIfPresent(form.locator('input[name="startDate"]'), evidence.startDate);
      if (evidence.ongoing) {
        await this.clickDialogTarget(form.locator('input[name="ongoing"]'));
      } else {
        await this.fillIfPresent(form.locator('input[name="endDate"]'), evidence.endDate);
      }
    }

    await this.clickDialogTarget(form.getByRole('button', { name: 'Add more detail', exact: true }));
    await this.humanFillIfPresent(form.locator('textarea[name="responsibilities"]'), evidence.responsibilities);
    await this.humanFillIfPresent(form.locator('textarea[name="achievements"]'), evidence.achievements);
    await this.humanFillDialogTarget(
      form.locator('input[name="skills"]'),
      evidence.demonstratedSkills.join(', ')
    );
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
      await this.fillDialogTarget(locator, value);
    }
  }

  private async humanFillIfPresent(locator: Locator, value: string | undefined): Promise<void> {
    if (value !== undefined && await locator.isVisible().catch(() => false)) {
      await this.humanFillDialogTarget(locator, value);
    }
  }

  private async clickDialogTarget(locator: Locator): Promise<void> {
    await this.frameDialogTarget(locator);
    await this.clickInPlace(locator);
  }

  private async humanFillDialogTarget(locator: Locator, value: string): Promise<void> {
    await this.frameDialogTarget(locator);
    await this.humanFillInPlace(locator, value);
  }

  private async fillDialogTarget(locator: Locator, value: string): Promise<void> {
    await this.frameDialogTarget(locator);
    await this.clickInPlace(locator);
    await this.fillInPlace(locator, value);
  }

  private async selectDialogTarget(locator: Locator, value: string): Promise<void> {
    await this.frameDialogTarget(locator);
    await this.selectInPlace(locator, value);
  }

  private async frameDialogTarget(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(320);
    if (!e2eConfig.demoRecording) return;
    const box = await locator.boundingBox();
    if (!box) return;
    await demoCursor.moveToPoint(this.page, {
      x: Math.max(20, box.x + Math.min(24, Math.max(box.width * 0.12, 12))),
      y: Math.max(20, box.y + Math.min(12, Math.max(box.height * 0.2, 8))),
    }, 320);
  }

  private selectedJobCard(candidate: ShowcaseCandidate): Locator {
    if (candidate.selectedJob.canonicalJobId) {
      const canonicalJobId = this.safeCanonicalJobId(candidate.selectedJob.canonicalJobId);
      return this.page
        .locator(`app-job-card[data-job-reference="${canonicalJobId}"]`)
        .getByTestId('job-result-card')
        .first();
    }
    return this.page.getByTestId('job-result-card')
      .filter({ hasText: candidate.selectedJob.title })
      .filter({ hasText: candidate.selectedJob.company })
      .first();
  }

  private configuredShowcaseJobCard(candidate: ShowcaseCandidate, results: Locator): Locator {
    if (!e2eConfig.allowRealProviderE2e) return this.selectedJobCard(candidate);
    return results.first();
  }

  private async captureLiveJobIdentity(card: Locator, candidate: ShowcaseCandidate): Promise<void> {
    const host = card.locator('xpath=ancestor::app-job-card');
    const canonicalJobId = (await host.getAttribute('data-job-reference'))?.trim();
    const provider = (await host.getAttribute('data-job-provider'))?.trim();
    if (!canonicalJobId || !provider) {
      throw new Error('The live showcase result did not expose canonical job and provider identity.');
    }
    this.safeCanonicalJobId(canonicalJobId);
    candidate.selectedJob = {
      title: (await card.locator('.job-title').innerText()).trim(),
      company: (await card.locator('.job-company').innerText()).trim(),
      canonicalJobId,
      provider
    };
  }

  private safeCanonicalJobId(value: string): string {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(value)) {
      throw new Error('The showcase job exposed an unsafe canonical identity.');
    }
    return value;
  }
}
