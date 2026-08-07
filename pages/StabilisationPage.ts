import path from 'node:path';
import {
  expect,
  type APIResponse,
  type Browser,
  type Locator,
  type Page,
  type Response,
  type Route
} from '@playwright/test';
import {
  StabilisationArtifacts,
  type StabilisationJobRecord
} from '../support/stabilisation-artifacts';
import { PUBLIC_NAMED_STATE_PASSWORD } from '../support/demo-data';
import { installGenerationStartBlocker } from '../support/stabilisation-runtime-safety';

export interface NamedStateIdentity {
  email: string;
  displayName: string;
}

export interface SelectedJob extends StabilisationJobRecord {
  providerDisplay?: string;
}

interface GenerationStartMonitor {
  operationId: string;
  assertSingleStart(): void;
  stop(): Promise<void>;
}

const TARGET_ROLES = ['Software Engineer', 'Software Developer'] as const;
const PROJECT_TITLE = 'Job Seeker Copilot';
const QUALIFICATION_TITLE = 'Bachelor of Music';
const JOB_REQUIREMENT_TERMS = [
  'Spring Boot',
  'TypeScript',
  'PostgreSQL',
  'Microservices',
  'REST API',
  'Java',
  'Angular',
  'Docker',
  'Testing',
  'Agile',
  'SQL',
  'Git'
] as const;
const DEMO_READY_IDENTITY = {
  email: 'alex.taylor92@example.com',
  displayName: 'Alex Taylor'
} as const;
const GENERATION_TIMEOUT_MS = 12 * 60 * 1000;
export const LIVE_CHECKPOINT_JOURNEY_COUNT = 5;
export const SINGLE_GENERATION_PROBE_JOURNEY_COUNT = 1;

export class StabilisationPage {
  private readonly artifacts: StabilisationArtifacts;
  private readonly usedJobs = new Set<string>();
  private readonly canonicalJobIdsByDomIdentity = new Map<string, string>();
  private readonly preflightJobs: SelectedJob[] = [];
  private readonly completedJobs: SelectedJob[] = [];
  private readonly generationOperationIds = new Set<string>();
  private selectedJob?: SelectedJob;
  private documentPreparationAttached = false;
  private staleRevisionConflictObserved = false;
  private cancellationSelectionRecovered = false;

  constructor(
    private page: Page,
    private readonly baseUrl: string,
    private readonly runId: string,
    artifactDirectory: string,
    private readonly manifestPath?: string
  ) {
    this.artifacts = new StabilisationArtifacts(
      path.resolve(__dirname, '..'),
      artifactDirectory,
      runId
    );
  }

  async signInDemoReady(identity: NamedStateIdentity): Promise<void> {
    await this.signIn(this.page, identity);
    await this.expectDashboard(this.page, identity);
  }

  async expectProfessionalProfileLabels(): Promise<void> {
    const profile = this.profileColumn(this.page);
    for (const section of [
      'Target roles',
      'Key skills',
      'Location and commute',
      'Working preferences',
      'Availability',
    ]) {
      await expect(profile.getByRole('heading', { name: section, exact: true })).toBeVisible();
    }
    for (const retiredQuestion of [
      'What jobs are you looking for?',
      'Which skills should stand out?',
      'Where do you want to work?',
      'What working patterns suit you?',
      'When can you start?',
    ]) {
      await expect(profile.getByText(retiredQuestion, { exact: true })).toHaveCount(0);
    }
    await this.artifacts.screenshot(this.page, 'profile-professional-section-labels');
  }

  async expectCompactEvidenceSummary(): Promise<void> {
    const summary = this.page.getByTestId('profile-evidence-summary');
    const summaryLabels = [
      'Work experience',
      'Qualifications',
      'Projects and achievements'
    ];
    await expect(summary).toBeVisible({ timeout: 60_000 });
    const waitForSummaryState = async (): Promise<
      'ready' | 'profile-error' | 'evidence-error'
    > => {
      const readiness = await this.page.waitForFunction(
        ({ labels }) => {
          const summaryNode = document.querySelector(
            '[data-testid="profile-evidence-summary"]'
          );
          if (!summaryNode) return null;
          const isVisible = (element: Element | null): boolean =>
            element instanceof HTMLElement && element.offsetParent !== null;
          if (isVisible(document.querySelector('#profile-save-error'))) {
            return 'profile-error';
          }
          if (isVisible(summaryNode.querySelector('.summary-retry'))) {
            return 'evidence-error';
          }
          const terms = Array.from(
            summaryNode.querySelectorAll('dt'),
            term => term.textContent?.trim()
          );
          return labels.every(label => terms.includes(label)) ? 'ready' : null;
        },
        { labels: summaryLabels },
        { timeout: 60_000 }
      );
      return await readiness.jsonValue() as
        'ready' | 'profile-error' | 'evidence-error';
    };

    let summaryState = await waitForSummaryState();
    if (summaryState === 'profile-error') {
      throw new Error('The profile reported an error while loading the evidence summary.');
    }
    if (summaryState === 'evidence-error') {
      await expect(
        summary.getByText('Experience summary unavailable.', { exact: true })
      ).toBeVisible();
      const retry = summary.getByRole('button', { name: 'Retry', exact: true });
      await expect(retry).toHaveCount(1);
      await expect(retry).toBeVisible();
      await retry.click();
      summaryState = await waitForSummaryState();
    }
    if (summaryState !== 'ready') {
      throw new Error('The evidence summary did not recover after its single safe retry.');
    }
    for (const label of summaryLabels) {
      await expect(summary.locator('dt').getByText(label, { exact: true })).toBeVisible();
    }
    await expect(
      summary.getByRole('button', { name: 'Manage experience & achievements', exact: true })
    ).toBeVisible();
    await expect(
      this.page.getByTestId('workspace-panel-search')
    ).toBeVisible();
    await expect(
      this.page.getByRole('heading', { name: 'Experience & achievements', exact: true })
    ).toHaveCount(1);
    await this.artifacts.screenshot(this.page, 'compact-evidence-summary');
  }

  async openEvidenceManager(): Promise<void> {
    await this.page
      .getByTestId('profile-evidence-summary')
      .getByRole('button', { name: 'Manage experience & achievements', exact: true })
      .click();
    const dialog = this.evidenceDialog();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Experience & achievements', exact: true })
    ).toBeVisible();
    await expect(
      dialog.getByText(
        'Record the experience, training and achievements you may want to use in applications.',
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: /Add experience or achievement/i })
    ).toBeVisible();
    await expect(
      dialog.locator('dt').getByText('User confirmed', { exact: true })
    ).toBeVisible();
    await this.artifacts.screenshot(this.page, 'advanced-evidence-manager');
  }

  async createAndConfirmProject(): Promise<void> {
    const dialog = this.evidenceDialog();
    await this.openEvidenceEditor(dialog, 'PROJECT');
    const form = dialog.locator('form');

    await expect(form.getByLabel('Project title', { exact: true })).toBeVisible();
    await expect(form.getByLabel('Qualification or training title', { exact: true })).toHaveCount(0);
    await form.getByLabel('Project title', { exact: true }).fill(PROJECT_TITLE);
    await form.getByLabel('Your role in the project (optional)', { exact: true })
      .fill('Full-stack developer');
    await form.locator('textarea[name="description"]').fill(
      'Built a job-search application with Java, Angular and PostgreSQL, integrating real job providers and evidence-grounded document generation.'
    );

    const ongoing = form.getByLabel('This is ongoing or current', { exact: true });
    await expect(form.locator('input[name="endDate"]')).toBeVisible();
    await ongoing.check();
    await expect(form.locator('input[name="endDate"]')).toHaveCount(0);
    await expect(
      form.getByText(/end date was removed and will not be saved/i)
    ).toBeVisible();
    await this.artifacts.screenshot(this.page, 'project-ongoing-hides-end-date');
    await ongoing.uncheck();
    await expect(form.locator('input[name="endDate"]')).toBeVisible();
    await form.locator('input[name="startDate"]').fill('2025-01-01');
    await form.locator('input[name="endDate"]').fill('2026-07-01');

    await form.getByRole('button', { name: 'Add more detail', exact: true }).click();
    await form.getByLabel('Outcomes or achievements (optional)', { exact: true }).fill(
      'Implemented resilient multi-provider paging and versioned evidence selection.'
    );
    await form.getByLabel(/Demonstrated skills/).fill(
      'Java, Angular, TypeScript, PostgreSQL, Testing'
    );

    await this.saveDraftAndConfirm(dialog, PROJECT_TITLE);
  }

  async createAndConfirmEmployment(): Promise<void> {
    const dialog = this.evidenceDialog();
    await this.openEvidenceEditor(dialog, 'EMPLOYMENT');
    const form = dialog.locator('form');

    await form.getByLabel('Role', { exact: true }).fill('Software Engineer');
    await form.getByLabel('Employer', { exact: true })
      .fill('Community Technology Project');
    await form.locator('textarea[name="description"]').fill(
      'Built and maintained accessible software for a community technology project.'
    );
    await form.locator('input[name="startDate"]').fill('2024-01-01');
    await form.locator('input[name="endDate"]').fill('2025-06-30');

    const ongoing = form.getByLabel('This is ongoing or current', { exact: true });
    await ongoing.check();
    await expect(form.locator('input[name="endDate"]')).toHaveCount(0);
    await expect(form.getByText(/end date was removed and will not be saved/i)).toBeVisible();
    await this.artifacts.screenshot(this.page, 'employment-current-hides-end-date');

    const created = this.waitForResponse('POST', '/api/auth/evidence');
    await form.getByRole('button', { name: 'Save as draft', exact: true }).click();
    const response = await created;
    this.assertSuccessful(response, 'saving current Employment evidence');
    const payload = response.request().postDataJSON() as Record<string, unknown>;
    expect(payload).toMatchObject({
      category: 'EMPLOYMENT',
      heading: 'Software Engineer',
      roleTitle: 'Software Engineer',
      organisationContext: 'Community Technology Project',
      ongoing: true,
      startDate: {
        precision: 'DAY',
        year: 2024,
        month: 1,
        day: 1
      }
    });
    expect(
      Object.prototype.hasOwnProperty.call(payload, 'endDate'),
      'Current Employment unexpectedly saved its cleared end date.'
    ).toBe(false);

    const card = await this.evidenceCard(dialog, 'Software Engineer');
    await card.getByRole('button', { name: 'Edit', exact: true }).click();
    const reopened = dialog.locator('form');
    await expect(reopened.locator('select[name="category"]')).toHaveValue('EMPLOYMENT');
    await expect(reopened.locator('input[name="startDate"]')).toHaveValue('2024-01-01');
    await expect(
      reopened.getByLabel('This is ongoing or current', { exact: true })
    ).toBeChecked();
    await expect(reopened.locator('input[name="endDate"]')).toHaveCount(0);
    await this.artifacts.screenshot(this.page, 'employment-current-authoritative-reopen');
    await reopened.getByRole('button', { name: 'Cancel', exact: true }).click();

    const confirmed = this.waitForMatchingResponse(candidate =>
      candidate.request().method() === 'POST'
      && /^\/api\/auth\/evidence\/[^/]+\/confirm$/
        .test(new URL(candidate.url()).pathname)
    );
    await card.getByRole('button', { name: 'Review & confirm', exact: true }).click();
    this.assertSuccessful(await confirmed, 'confirming current Employment evidence');
    await expect(card.getByText('User confirmed', { exact: true })).toBeVisible();
  }

  async createAndConfirmQualification(): Promise<void> {
    const dialog = this.evidenceDialog();
    await this.openEvidenceEditor(dialog, 'QUALIFICATION_TRAINING');
    const form = dialog.locator('form');

    await expect(form.getByLabel('Qualification or training title', { exact: true })).toBeVisible();
    await expect(form.getByLabel('Project title', { exact: true })).toHaveCount(0);
    await form.getByLabel('Qualification or training title', { exact: true })
      .fill(QUALIFICATION_TITLE);
    await form.getByLabel('Awarding or issuing body', { exact: true })
      .fill('Royal Birmingham Conservatoire');
    await form.locator('textarea[name="description"]').fill(
      'Degree-level study demonstrating disciplined practice, collaboration and performance.'
    );

    const status = form.locator('select[name="completionStatus"]');
    const completionDate = form.locator('input[name="completionDate"]');
    const expectedCompletionDate = form.locator('input[name="expectedCompletionDate"]');
    await expect(completionDate).toBeVisible();
    await expect(expectedCompletionDate).toHaveCount(0);
    await status.selectOption({ label: 'In progress' });
    await expect(completionDate).toHaveCount(0);
    await expect(expectedCompletionDate).toBeVisible();
    await expect(form.getByText(/Only the expected completion date is required/i)).toBeVisible();
    await this.artifacts.screenshot(this.page, 'qualification-in-progress-date');
    await status.selectOption({ label: 'Completed' });
    await expect(expectedCompletionDate).toHaveCount(0);
    await completionDate.fill('2020-07-01');

    const privateCredentialIdentifier = form.locator(
      'input[name="privateCredentialIdentifier"]'
    );
    await expect(privateCredentialIdentifier).toHaveCount(0);
    await form.getByRole('button', { name: 'Add more detail', exact: true }).click();
    await expect(privateCredentialIdentifier).toBeVisible();
    await form.getByLabel(/Demonstrated skills/).fill(
      'Creative problem solving, Collaboration'
    );

    await this.saveDraftAndConfirm(dialog, QUALIFICATION_TITLE);
  }

  async closeEvidenceManagerAndVerifySummary(): Promise<void> {
    const dialog = this.evidenceDialog();
    await dialog.getByRole('button', {
      name: 'Close Experience and Evidence manager',
      exact: true
    }).click();
    await expect(dialog).toBeHidden();

    const summary = this.page.getByTestId('profile-evidence-summary');
    await expect(
      summary.locator('.evidence-summary-row').filter({ hasText: 'Qualifications' })
        .locator('dd')
    ).toContainText(/confirmed/);
    await expect(
      summary.locator('.evidence-summary-row').filter({
        hasText: 'Projects and achievements',
      }).locator('dd')
    ).toContainText(/confirmed/);
    await this.artifacts.screenshot(this.page, 'evidence-summary-after-confirmation');
  }

  async prepareConfirmedGenerationEvidence(): Promise<void> {
    await this.openEvidenceManager();
    await this.createAndConfirmProject();
    await this.createAndConfirmQualification();
    await this.closeEvidenceManagerAndVerifySummary();
  }

  async configureSearchProfile(): Promise<void> {
    await this.replaceTargetRoles([...TARGET_ROLES]);
    await this.setHybridWorkingPreference();
    await this.setSearchLocation('RG1 1AA');
  }

  async verifyIndependentRoleSearchAndPaging(screenshotName = 'two-role-paging'): Promise<void> {
    await this.openSearchWorkspace();
    await this.expectRealProviders();

    await this.selectRole(TARGET_ROLES[0]);
    await this.navigateToPage(1);
    const engineerPageOne = await this.currentPageJobKeys();
    await this.moveToNextPage();
    const engineerPageTwo = await this.currentPageJobKeys();
    this.expectNoOverlap(engineerPageOne, engineerPageTwo, TARGET_ROLES[0]);

    await this.selectRole(TARGET_ROLES[1]);
    await this.navigateToPage(1);
    const developerPageOne = await this.currentPageJobKeys();
    await this.moveToNextPage();
    const developerPageTwo = await this.currentPageJobKeys();
    this.expectNoOverlap(developerPageOne, developerPageTwo, TARGET_ROLES[1]);

    await this.selectRole(TARGET_ROLES[0]);
    await this.expectCurrentPage(2);
    const refreshResponse = this.waitForResponse('POST', '/api/jobs/search');
    await this.jobWorkspace().getByRole('button', { name: /^Refresh$/ }).click();
    this.assertSuccessful(await refreshResponse, 'refreshing page 2 for the first target role');
    await this.expectCurrentPage(2);

    await this.verifyLateRefreshDoesNotOverwriteActiveRole(developerPageTwo);

    await this.artifacts.screenshot(this.page, screenshotName);
    for (const role of TARGET_ROLES) {
      await this.selectRole(role);
      await this.navigateToPage(1);
    }
  }

  private async verifyLateRefreshDoesNotOverwriteActiveRole(
    expectedSecondRoleJobs: string[]
  ): Promise<void> {
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>(resolve => {
      releaseRefresh = resolve;
    });
    let resolveUpstream!: (response: APIResponse) => void;
    let rejectUpstream!: (error: Error) => void;
    const upstreamReady = new Promise<APIResponse>((resolve, reject) => {
      resolveUpstream = resolve;
      rejectUpstream = reject;
    });
    let interceptNextSearch = true;
    const handler = async (route: Route): Promise<void> => {
      const request = route.request();
      if (
        !interceptNextSearch
        || request.method() !== 'POST'
        || new URL(request.url()).pathname !== '/api/jobs/search'
      ) {
        await route.continue();
        return;
      }
      interceptNextSearch = false;
      try {
        const upstream = await route.fetch();
        resolveUpstream(upstream);
        await refreshGate;
        await route.fulfill({ response: upstream });
      } catch (error) {
        rejectUpstream(error instanceof Error ? error : new Error(String(error)));
        await route.abort('failed').catch(() => undefined);
      }
    };

    await this.page.route('**/api/jobs/search', handler);
    try {
      const deliveredRefresh = this.waitForResponse('POST', '/api/jobs/search');
      await this.jobWorkspace().getByRole('button', { name: /^Refresh$/ }).click();
      const upstream = await upstreamReady;
      expect(
        upstream.ok(),
        `The held real refresh returned HTTP ${upstream.status()}.`
      ).toBe(true);
      expect(upstream.headers()['content-type'] ?? '').toContain('application/json');

      await this.roleButton(TARGET_ROLES[1]).click();
      await this.waitForRoleResults(TARGET_ROLES[1]);
      await this.expectCurrentPage(2);
      releaseRefresh();

      const delivered = await deliveredRefresh;
      this.assertSuccessful(
        delivered,
        'delivering the held real-provider refresh after switching target-role tabs'
      );
      await this.waitForRoleResults(TARGET_ROLES[1]);
      await this.expectCurrentPage(2);
      expect(
        await this.currentPageJobKeys(),
        'A stale first-role refresh overwrote the active second-role cards.'
      ).toEqual(expectedSecondRoleJobs);
    } finally {
      releaseRefresh();
      await this.page.unroute('**/api/jobs/search', handler);
    }
  }

  async verifyExpandableJobDescription(): Promise<void> {
    const card = await this.requireExpandableCard();
    const description = card.locator('.job-description');
    const collapsed = (await description.innerText()).trim();
    expect(collapsed.endsWith('…')).toBe(true);
    await expect(description.locator('script, iframe, img, object')).toHaveCount(0);

    await card.getByRole('button', { name: 'Read more', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Show less', exact: true })).toBeVisible();
    const expanded = (await description.innerText()).trim();
    expect(expanded.length).toBeGreaterThan(collapsed.length);
    await this.artifacts.screenshot(this.page, 'job-description-expanded');

    await card.getByRole('button', { name: 'Show less', exact: true }).click();
    await expect(description).toHaveText(collapsed);
    await this.artifacts.screenshot(this.page, 'job-description-collapsed');
  }

  async saveJobAndPreviewEvidenceSelection(): Promise<void> {
    this.documentPreparationAttached = false;
    const selected = await this.selectDistinctNewJob();
    await this.saveSelectedJob(selected);
    const selector = await this.openAndPopulateEvidenceSelector(selected);
    await this.artifacts.screenshot(this.page, 'evidence-selection-inside-selected-job');
    await selector.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(this.page.getByTestId('generation-evidence-selector')).toHaveCount(0);
    await expect(
      this.selectedJobCard().getByTestId('generate-documents-button')
    ).toBeVisible();
    this.documentPreparationAttached = true;
  }

  async expectDocumentPreparationAttached(): Promise<void> {
    expect(
      this.documentPreparationAttached,
      'The selected job did not retain its in-card document preparation flow.'
    ).toBe(true);
    const card = this.selectedJobCard();
    await expect(card).toBeVisible();
    await expect(card.getByTestId('generation-evidence-selector')).toHaveCount(0);
    await expect(card.getByTestId('generate-documents-button')).toBeVisible();
  }

  async assertRealGenerationRuntime(allowAiGeneration: boolean): Promise<void> {
    if (!allowAiGeneration) {
      throw new Error(
        'Live stabilisation generation is fail-closed. Set ALLOW_AI_GENERATION=true explicitly.'
      );
    }
    await this.expectRealProviders();
    await this.page.getByTestId('workspace-tab-documents').click();
    await expect(this.page.getByTestId('workspace-panel-documents')).toBeVisible();
    await expect(
      this.page.getByText('Real OpenAI generation', { exact: true })
    ).toBeVisible();
    await this.page.getByTestId('workspace-tab-search').click();
    await this.expectRealProviders();
  }

  async runFiveConsecutiveJourneys(): Promise<void> {
    await this.preflightDistinctJourneys(
      LIVE_CHECKPOINT_JOURNEY_COUNT,
      'The live checkpoint'
    );
    for (
      let runNumber = 1;
      runNumber <= LIVE_CHECKPOINT_JOURNEY_COUNT;
      runNumber += 1
    ) {
      await this.updateAvailability(runNumber);
      await this.verifyIndependentRoleSearchAndPaging(`run-${runNumber}-role-paging`);
      const selected = await this.selectPreflightJob(runNumber);
      await this.saveSelectedJob(selected);
      await this.openAndPopulateEvidenceSelector(selected);
      const startMonitor = await this.startGeneration(runNumber === 1);
      try {
        if (runNumber === 1) {
          await this.artifacts.screenshot(this.page, 'run-1-processing-before-browser-refresh');
          const card = this.selectedJobCard();
          await expect(card.getByText('Processing', { exact: true })).toHaveCount(1);
          await expect(card.getByTestId('cancel-generation-button')).toBeVisible();
          await this.reloadAndRestoreSelectedJob();
        }

        await this.waitForGenerationSuccess();
        startMonitor.assertSingleStart();
        expect(
          this.generationOperationIds.has(startMonitor.operationId),
          'Two completed runs returned the same generation operation ID.'
        ).toBe(false);
        this.generationOperationIds.add(startMonitor.operationId);
      } finally {
        await startMonitor.stop();
      }
      await this.downloadSelectedDocuments(runNumber);
      await this.artifacts.screenshot(this.page, `run-${runNumber}-generation-succeeded`);
      await this.reloadAndVerifyPersistence(runNumber);
      this.completedJobs.push({ ...selected });
    }
    if (!this.manifestPath) {
      throw new Error('The live checkpoint requires a bounded persistence manifest path.');
    }
    await this.artifacts.savePersistenceManifest(this.manifestPath, this.completedJobs);
  }

  async runSingleGenerationProbe(
    allowAiGeneration: boolean,
    allowSingleGenerationProbe: boolean
  ): Promise<void> {
    if (!allowAiGeneration || !allowSingleGenerationProbe) {
      throw new Error(
        'The single-generation probe is fail-closed. Set ALLOW_AI_GENERATION=true and ALLOW_SINGLE_GENERATION_PROBE=true explicitly.'
      );
    }
    await this.preflightDistinctJourneys(
      SINGLE_GENERATION_PROBE_JOURNEY_COUNT,
      'The single-generation probe'
    );
    await this.updateAvailability(1);
    const selected = await this.selectPreflightJob(1);
    await this.saveSelectedJob(selected);
    await this.openAndPopulateEvidenceSelector(selected);

    const approvals: Response[] = [];
    const recordApproval = (response: Response): void => {
      const request = response.request();
      if (
        request.method() === 'POST'
        && /^\/api\/v1\/document-generation\/operations\/[^/]+\/approve$/
          .test(new URL(response.url()).pathname)
      ) {
        approvals.push(response);
      }
    };
    this.page.on('response', recordApproval);
    let startMonitor: GenerationStartMonitor | undefined;
    try {
      startMonitor = await this.startGeneration(false);
      await this.waitForGenerationSuccess();
      startMonitor.assertSingleStart();
      this.assertSingleApproval(approvals, startMonitor.operationId);
      expect(
        this.generationOperationIds.has(startMonitor.operationId),
        'The probe reused an already-observed generation operation ID.'
      ).toBe(false);
      this.generationOperationIds.add(startMonitor.operationId);
    } finally {
      this.page.off('response', recordApproval);
      await startMonitor?.stop();
    }

    await this.downloadSelectedDocuments(1);
    await this.artifacts.screenshot(this.page, 'probe-generation-succeeded');
    await this.reloadAndVerifyPersistence(1);
    this.completedJobs.push({ ...selected });
  }

  private async preflightDistinctJourneys(
    requiredCount: number,
    journeyLabel: string
  ): Promise<void> {
    this.preflightJobs.length = 0;
    const identities = new Set<string>();
    candidateSearch:
    for (const role of TARGET_ROLES) {
      await this.selectRole(role);
      for (const pageNumber of [1, 2]) {
        await this.navigateToPage(pageNumber);
        const cards = this.jobWorkspace().getByTestId('job-result-card');
        const count = await cards.count();
        for (let index = 0; index < count; index += 1) {
          const card = cards.nth(index);
          await this.expandCard(card);
          const save = card.getByTestId('track-application-button');
          const generate = card.getByTestId('generate-documents-button');
          if (
            !(await save.isVisible().catch(() => false))
            || !(await save.isEnabled().catch(() => false))
            || !(await generate.isVisible().catch(() => false))
            || !(await generate.isEnabled().catch(() => false))
          ) {
            continue;
          }
          const requirementTerms = await this.jobRequirementTerms(card);
          if (requirementTerms.length === 0) continue;
          const selected = await this.readSelectedCardIdentity(
            card,
            role,
            pageNumber,
            requirementTerms
          );
          if (identities.has(selected.canonicalJobId)) continue;
          identities.add(selected.canonicalJobId);
          this.preflightJobs.push(selected);
          if (this.preflightJobs.length === requiredCount) break candidateSearch;
        }
      }
    }

    expect(
      this.preflightJobs,
      `${journeyLabel} did not have ${requiredCount} distinct eligible ${
        requiredCount === 1 ? 'job' : 'jobs'
      } before any OpenAI spend.`
    ).toHaveLength(requiredCount);
    for (const role of TARGET_ROLES) {
      await this.selectRole(role);
      await this.navigateToPage(1);
    }
  }

  private async selectPreflightJob(runNumber: number): Promise<SelectedJob> {
    const expected = this.preflightJobs[runNumber - 1];
    if (!expected) {
      throw new Error(`No preflight job was reserved for live run ${runNumber}.`);
    }
    await this.selectRole(expected.role);
    await this.navigateToPage(expected.page);
    this.selectedJob = { ...expected };
    const card = this.selectedJobCard();
    await expect(card).toBeVisible({ timeout: 60_000 });
    await this.expandCard(card);
    await expect(card.getByTestId('track-application-button')).toBeEnabled();
    await expect(card.getByTestId('generate-documents-button')).toBeEnabled();
    const requirementTerms = await this.jobRequirementTerms(card);
    expect(
      requirementTerms,
      'A preflight job lost every bounded requirement term before generation.'
    ).not.toEqual([]);

    const observed = await this.readSelectedCardIdentity(
      card,
      expected.role,
      expected.page,
      requirementTerms
    );
    expect(observed).toMatchObject({
      canonicalJobId: expected.canonicalJobId,
      providerDisplay: expected.providerDisplay,
      title: expected.title,
      company: expected.company,
      role: expected.role,
      page: expected.page,
      requirementTerms: expected.requirementTerms
    });
    expect(
      this.usedJobs.has(observed.canonicalJobId),
      'A preflight job was selected twice.'
    ).toBe(false);
    this.usedJobs.add(observed.canonicalJobId);
    this.selectedJob = observed;
    return observed;
  }

  expectFiveJourneysCompleted(): void {
    expect(
      this.usedJobs.size,
      'The checkpoint did not complete five distinct jobs.'
    ).toBe(LIVE_CHECKPOINT_JOURNEY_COUNT);
    expect(
      this.generationOperationIds.size,
      'The checkpoint did not reconcile five unique generation operations.'
    ).toBe(LIVE_CHECKPOINT_JOURNEY_COUNT);
    expect(this.completedJobs, 'The checkpoint did not persist five completed jobs.')
      .toHaveLength(LIVE_CHECKPOINT_JOURNEY_COUNT);
  }

  expectSingleGenerationProbeCompleted(): void {
    expect(
      this.usedJobs.size,
      'The probe did not complete exactly one distinct job.'
    ).toBe(SINGLE_GENERATION_PROBE_JOURNEY_COUNT);
    expect(
      this.generationOperationIds.size,
      'The probe did not reconcile exactly one generation operation.'
    ).toBe(SINGLE_GENERATION_PROBE_JOURNEY_COUNT);
    expect(
      this.completedJobs,
      'The probe did not persist exactly one completed job.'
    ).toHaveLength(SINGLE_GENERATION_PROBE_JOURNEY_COUNT);
  }

  async verifyStaleRevisionAcrossTwoSessions(
    browser: Browser,
    identity: NamedStateIdentity
  ): Promise<void> {
    this.staleRevisionConflictObserved = false;
    const secondContext = await browser.newContext({
      baseURL: this.baseUrl,
      viewport: { width: 1440, height: 1000 },
    });
    const generationStartBlocker = await installGenerationStartBlocker(
      secondContext,
      'stale secondary-session firewall'
    );
    try {
      const secondPage = await secondContext.newPage();
      const secondSession = new StabilisationPage(
        secondPage,
        this.baseUrl,
        `${this.runId}-second-session`,
        path.relative(path.resolve(__dirname, '..'), path.dirname(this.artifacts.root)),
        this.manifestPath
      );
      await secondSession.signInDemoReady(identity);

      await this.updateAvailability(9);

      const profile = this.profileColumn(secondPage);
      await profile.getByRole('button', { name: 'Edit Key skills', exact: true }).click();
      const editor = profile.locator('#profile-key-skills-editor');
      const input = editor.getByLabel('Skills', { exact: true });
      await input.fill('Stale revision probe');
      await input.press('Enter');

      const rejectedSave = secondPage.waitForResponse(response =>
        response.request().method() === 'PATCH'
        && new URL(response.url()).pathname === '/api/auth/profile'
      );
      await profile.getByRole('button', { name: 'Save this section', exact: true }).click();
      const response = await rejectedSave;
      expect(response.status()).toBe(409);
      await expect(
        profile.getByRole('alert')
      ).toHaveText('Your profile changed in another session. Reload and try again.');
      this.staleRevisionConflictObserved = true;
      await secondSession.artifacts.screenshot(secondPage, 'stale-profile-revision-conflict');
    } finally {
      try {
        generationStartBlocker.assertNoAttempts();
      } finally {
        try {
          await generationStartBlocker.stop();
        } finally {
          await secondContext.close();
        }
      }
    }
  }

  expectStaleRevisionConflict(): void {
    expect(
      this.staleRevisionConflictObserved,
      'The stale browser session did not receive the authoritative revision conflict.'
    ).toBe(true);
  }

  async cancelOneGenerationAndVerifySelectionRecovery(
    allowAiGeneration: boolean,
    allowCancellation: boolean
  ): Promise<void> {
    this.cancellationSelectionRecovered = false;
    if (!allowAiGeneration || !allowCancellation) {
      throw new Error(
        'Live cancellation is fail-closed. Set ALLOW_AI_GENERATION=true and ALLOW_CANCELLATION_E2E=true explicitly.'
      );
    }
    await this.assertRealGenerationRuntime(allowAiGeneration);
    await this.updateAvailability(1);
    await this.verifyIndependentRoleSearchAndPaging('cancellation-role-paging');
    const selected = await this.selectDistinctNewJob();
    await this.saveSelectedJob(selected);
    await this.openAndPopulateEvidenceSelector(selected);
    const startMonitor = await this.startGeneration(false);
    try {
      const card = this.selectedJobCard();
      await expect(card.getByText('Processing', { exact: true })).toHaveCount(1);
      const cancellation = this.waitForMatchingResponse(
        response => response.request().method() === 'DELETE'
          && /^\/api\/v1\/document-generation\/operations\/[^/]+$/
            .test(new URL(response.url()).pathname)
      );
      await card.getByTestId('cancel-generation-button').click();
      this.assertSuccessful(await cancellation, 'cancelling document generation');
      await expect(card.getByTestId('cancel-generation-button')).toHaveCount(0);
      await expect(card.getByText(/Generation cancelled/i)).toBeVisible();
      startMonitor.assertSingleStart();

      const selector = await this.openAndPopulateEvidenceSelector(selected, false);
      await this.expectEvidenceChecked(selector, PROJECT_TITLE);
      await this.expectEvidenceChecked(selector, QUALIFICATION_TITLE);
      await this.artifacts.screenshot(this.page, 'cancelled-generation-retains-evidence');
      await selector.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(card.getByTestId('generate-documents-button')).toBeVisible();
      this.cancellationSelectionRecovered = true;
    } finally {
      await startMonitor.stop();
    }
  }

  expectCancellationSelectionRecovery(): void {
    expect(
      this.cancellationSelectionRecovered,
      'The cancelled operation did not preserve a retryable evidence selection.'
    ).toBe(true);
  }

  async verifyRestoredRuntimePersistence(jobs: SelectedJob[]): Promise<void> {
    expect(jobs, 'The restored-runtime smoke requires five manifest jobs.').toHaveLength(5);
    expect(new Set(jobs.map(job => job.canonicalJobId)).size).toBe(5);
    await this.signIn(this.page, DEMO_READY_IDENTITY);
    await this.expectDashboard(this.page, DEMO_READY_IDENTITY);

    await this.page.getByTestId('workspace-tab-applications').click();
    const applications = this.page.getByTestId('applications-workspace');
    await expect(applications).toBeVisible();
    for (const job of jobs) {
      const application = this.applicationCard(applications, job);
      await expect(application, `The restored runtime lost ${job.title}.`).toBeVisible();
      await expect(application).toContainText(job.title);
      await expect(application).toContainText(job.company);
      await expect(application).toContainText('Documents prepared');
    }
    await this.artifacts.screenshot(this.page, 'restored-runtime-applications');

    await this.page.getByTestId('workspace-tab-documents').click();
    const documents = this.page.getByTestId('documents-workspace');
    await expect(documents).toBeVisible();
    await expect(this.page.getByText('Real OpenAI generation', { exact: true })).toBeVisible();
    for (const job of jobs) {
      await expect(this.documentCard(documents, job.cvDocumentId, 'CV', job))
        .toBeVisible({ timeout: 60_000 });
      await expect(
        this.documentCard(documents, job.coverLetterDocumentId, 'cover letter', job)
      ).toBeVisible({ timeout: 60_000 });
    }
    await this.artifacts.screenshot(this.page, 'restored-runtime-documents');

    for (let index = 0; index < jobs.length; index += 1) {
      this.selectedJob = { ...jobs[index] };
      await this.navigateToSelectedJob(this.selectedJob);
      const card = this.selectedJobCard();
      await expect(card.getByText('Documents prepared', { exact: true })).toBeVisible();
      await expect(card.locator('.generated-downloads')).toBeVisible();
      if (index === 0) await this.downloadSelectedDocuments(1);
    }
    await this.artifacts.screenshot(this.page, 'restored-runtime-search');
  }

  private async signIn(page: Page, identity: NamedStateIdentity): Promise<void> {
    await page.goto(this.baseUrl);
    await page.getByTestId('sign-in-tab')
      .or(page.locator('#tab-btn-signin'))
      .or(page.getByRole('button', { name: /sign in/i }))
      .first()
      .click();
    await page.getByLabel(/email address/i).fill(identity.email);
    await page.getByLabel(/^password$/i).fill(PUBLIC_NAMED_STATE_PASSWORD);
    const signInForm = page.locator('#mode-signin-segment form').filter({
      has: page.locator('#login-password')
    });
    const [response] = await Promise.all([
      page.waitForResponse(candidate =>
        candidate.request().method() === 'POST'
        && new URL(candidate.url()).pathname === '/api/auth/login'
      ),
      signInForm.getByRole('button', { name: 'Sign in', exact: true }).click()
    ]);
    this.assertSuccessful(response, 'signing in to the DEMO_READY account');
  }

  private async expectDashboard(page: Page, identity: NamedStateIdentity): Promise<void> {
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('workspace-tab-search')).toBeVisible();
    await expect(page.locator('#left-sidebar')).toContainText(identity.displayName);
  }

  private profileColumn(page: Page): Locator {
    return page.locator('#left-sidebar');
  }

  private evidenceDialog(): Locator {
    return this.page.locator('#experience-evidence-dialog');
  }

  private async openEvidenceEditor(dialog: Locator, category: string): Promise<void> {
    await dialog.getByRole('button', { name: /Add experience or achievement/i }).click();
    const form = dialog.locator('form');
    await expect(form).toBeVisible();
    const categorySelector = form.locator('select[name="category"]');
    await expect(categorySelector).toBeVisible();
    await categorySelector.selectOption(category);
  }

  private async saveDraftAndConfirm(dialog: Locator, heading: string): Promise<void> {
    const created = this.waitForResponse('POST', '/api/auth/evidence');
    await dialog.locator('form')
      .getByRole('button', { name: 'Save as draft', exact: true })
      .click();
    this.assertSuccessful(await created, `saving ${heading} as draft evidence`);

    const card = await this.evidenceCard(dialog, heading);
    const confirmed = this.waitForMatchingResponse(response =>
      response.request().method() === 'POST'
      && /^\/api\/auth\/evidence\/[^/]+\/confirm$/.test(new URL(response.url()).pathname)
    );
    await card.getByRole('button', { name: 'Review & confirm', exact: true }).click();
    this.assertSuccessful(await confirmed, `confirming ${heading} evidence`);
    await expect(card.getByText('User confirmed', { exact: true })).toBeVisible();
  }

  private async evidenceCard(dialog: Locator, heading: string): Promise<Locator> {
    // TODO frontend: expose data-testid="evidence-card"; the semantic article
    // plus exact heading text is the narrowest selector currently available.
    const cards = dialog.locator('article.evidence-card').filter({
      has: this.page.getByRole('heading', { name: heading, exact: true })
    });
    await expect(cards).toHaveCount(1);
    await expect(cards).toBeVisible();
    return cards;
  }

  private async replaceTargetRoles(roles: string[]): Promise<void> {
    const profile = this.profileColumn(this.page);
    await profile.getByRole('button', { name: 'Edit Target roles', exact: true }).click();
    const editor = profile.locator('#profile-target-roles-editor');
    await expect(editor).toBeVisible();
    const removeButtons = editor.getByRole('button', { name: /^Remove / });
    const initialRoleCount = await removeButtons.count();
    for (let remaining = initialRoleCount; remaining > 0; remaining -= 1) {
      await removeButtons.first().click();
      await expect(removeButtons).toHaveCount(remaining - 1);
    }
    await expect(removeButtons).toHaveCount(0);
    const input = editor.getByLabel('Target roles', { exact: true });
    for (const role of roles) {
      await input.fill(role);
      await input.press('Enter');
    }
    await this.saveProfileSection(profile, 'replacing target roles');
    for (const role of roles) {
      await expect(
        profile.getByRole('heading', { name: 'Target roles', exact: true })
          .locator('..')
      ).toContainText(role);
    }
  }

  private async setHybridWorkingPreference(): Promise<void> {
    const profile = this.profileColumn(this.page);
    await profile.getByRole('button', { name: 'Edit Working preferences', exact: true }).click();
    const editor = profile.locator('#profile-working-preferences-editor');
    const hybrid = editor.getByLabel('Hybrid', { exact: true });
    if (!(await hybrid.isChecked())) await hybrid.check();
    const fullTime = editor.getByLabel('Full time', { exact: true });
    if (!(await fullTime.isChecked())) await fullTime.check();
    await this.saveProfileSection(profile, 'setting working preferences');
  }

  private async setSearchLocation(postcode: string): Promise<void> {
    const profile = this.profileColumn(this.page);
    await profile.getByRole('button', { name: 'Edit Location and commute', exact: true }).click();
    const editor = profile.locator('#profile-location-editor');
    const input = editor.getByLabel('Town or postcode', { exact: true });
    await input.fill(postcode);
    const options = editor.locator('#profile-location-options');
    await expect(options).toBeVisible();
    await options.getByRole('button').first().click();
    await this.saveProfileSection(profile, 'setting the search location');
  }

  private async updateAvailability(noticePeriodDays: number): Promise<void> {
    const profile = this.profileColumn(this.page);
    await profile.getByRole('button', { name: 'Edit Availability', exact: true }).click();
    const editor = profile.locator('#profile-availability-editor');
    await editor.getByLabel('Or notice period in days', { exact: true })
      .fill(String(noticePeriodDays));
    await this.saveProfileSection(profile, `setting availability for run ${noticePeriodDays}`);
    await expect(
      profile.getByRole('heading', { name: 'Availability', exact: true }).locator('..')
    ).toContainText(`${noticePeriodDays} days' notice`);
  }

  private async saveProfileSection(profile: Locator, action: string): Promise<void> {
    const response = this.waitForResponse('PATCH', '/api/auth/profile');
    await profile.getByRole('button', { name: 'Save this section', exact: true }).click();
    this.assertSuccessful(await response, action);
    await expect(
      profile.getByRole('button', { name: 'Save this section', exact: true })
    ).toHaveCount(0);
  }

  private async openSearchWorkspace(): Promise<void> {
    await this.page.getByTestId('workspace-tab-search').click();
    await expect(this.page.getByTestId('job-results-workspace')).toBeVisible();
  }

  private jobWorkspace(): Locator {
    return this.page.getByTestId('job-results-workspace');
  }

  private async expectRealProviders(): Promise<void> {
    const badge = this.jobWorkspace().getByTestId('job-search-provider-mode');
    await expect(badge).toHaveText(
      /^\s*Real providers(?: — partial availability)?\s*$/
    );
    await expect(badge).not.toContainText(/Fixture|temporarily unavailable|configuration error/i);
  }

  private roleButton(role: string): Locator {
    return this.jobWorkspace()
      .locator('[aria-label="Target role filters"]')
      .getByRole('button')
      .filter({ hasText: role })
      .first();
  }

  private async selectRole(role: string): Promise<void> {
    const button = this.roleButton(role);
    await expect(button).toBeVisible();
    if (await button.getAttribute('aria-current') !== 'true') {
      await button.click();
    }
    await this.waitForRoleResults(role);
  }

  private async waitForRoleResults(role: string): Promise<void> {
    const button = this.roleButton(role);
    await expect(button).not.toContainText(/Searching|Not searched|Unavailable/, { timeout: 60_000 });
    const countText = await button.innerText();
    const resultCount = Number(countText.match(/\((\d+)\)/)?.[1] ?? 0);
    expect(resultCount, `${role} did not return an independent populated result set.`)
      .toBeGreaterThan(0);
    await expect(this.jobWorkspace().locator('.results-count')).toContainText(`for ${role}`);
    await expect(this.jobWorkspace().getByTestId('job-result-card').first()).toBeVisible();
    await this.expectRealProviders();
  }

  private async moveToNextPage(): Promise<void> {
    const currentPage = await this.activePage();
    const next = this.jobWorkspace().getByRole('button', { name: /^Next$/ });
    await expect(next, 'Another real-provider result page was not available.').toBeVisible();
    await expect(next).toBeEnabled();
    await next.click();
    await this.expectCurrentPage(currentPage + 1);
  }

  private async moveToPreviousPage(): Promise<void> {
    const currentPage = await this.activePage();
    expect(currentPage, 'Cannot move before the first search page.').toBeGreaterThan(1);
    const previous = this.jobWorkspace().getByRole('button', { name: /^Previous$/ });
    await expect(previous).toBeVisible();
    await expect(previous).toBeEnabled();
    await previous.click();
    await this.expectCurrentPage(currentPage - 1);
  }

  private async navigateToPage(pageNumber: number): Promise<void> {
    expect(pageNumber, 'Search navigation is bounded to pages 1 through 20.')
      .toBeGreaterThanOrEqual(1);
    expect(pageNumber, 'Search navigation is bounded to pages 1 through 20.')
      .toBeLessThanOrEqual(20);
    for (let transitions = 0; transitions < 20; transitions += 1) {
      const currentPage = await this.activePage();
      if (currentPage === pageNumber) {
        await this.expectCurrentPage(pageNumber);
        return;
      }
      if (currentPage < pageNumber) {
        await this.moveToNextPage();
      } else {
        await this.moveToPreviousPage();
      }
    }
    throw new Error(`Search navigation did not reach bounded page ${pageNumber}.`);
  }

  private async expectCurrentPage(pageNumber: number): Promise<void> {
    await expect(
      this.jobWorkspace().getByText(new RegExp(`^Page ${pageNumber} of \\d+$`))
    ).toBeVisible();
    await expect(this.jobWorkspace().locator('.results-count')).toContainText(
      new RegExp(`Showing \\d+-\\d+ of \\d+ matches`)
    );
    await expect(this.jobWorkspace().getByTestId('job-result-card').first()).toBeVisible();
  }

  private async currentPageJobKeys(): Promise<string[]> {
    const cards = this.jobWorkspace().getByTestId('job-result-card');
    await expect(cards.first()).toBeVisible();
    const keys: string[] = [];
    for (let index = 0; index < await cards.count(); index += 1) {
      keys.push(await this.cardCanonicalDomIdentity(cards.nth(index)));
    }
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size, 'A result page contained duplicate jobs.').toBe(keys.length);
    return keys;
  }

  private expectNoOverlap(first: string[], second: string[], role: string): void {
    const firstKeys = new Set(first);
    const overlap = second.filter(key => firstKeys.has(key));
    expect(overlap, `${role} repeated jobs across page boundaries.`).toEqual([]);
  }

  private async requireExpandableCard(): Promise<Locator> {
    const cards = this.jobWorkspace().getByTestId('job-result-card');
    for (let index = 0; index < await cards.count(); index += 1) {
      const card = cards.nth(index);
      await this.expandCard(card);
      if (await card.getByRole('button', { name: 'Read more', exact: true }).isVisible()
        .catch(() => false)) {
        return card;
      }
    }
    throw new Error('No real-provider job exposed a bounded expandable description.');
  }

  private async selectDistinctNewJob(): Promise<SelectedJob> {
    const role = await this.activeRole();
    const currentPage = await this.activePage();
    const cards = this.jobWorkspace().getByTestId('job-result-card');
    for (let index = 0; index < await cards.count(); index += 1) {
      const card = cards.nth(index);
      const domIdentity = await this.cardCanonicalDomIdentity(card);
      const knownCanonicalJobId = this.canonicalJobIdsByDomIdentity.get(domIdentity);
      if (knownCanonicalJobId && this.usedJobs.has(knownCanonicalJobId)) continue;
      await this.expandCard(card);
      const save = card.getByTestId('track-application-button');
      const generate = card.getByTestId('generate-documents-button');
      if (await save.isVisible().catch(() => false)
        && await save.isEnabled().catch(() => false)
        && await generate.isVisible().catch(() => false)
        && await generate.isEnabled().catch(() => false)) {
        const requirementTerms = await this.jobRequirementTerms(card);
        if (requirementTerms.length === 0) continue;
        const selected = await this.readSelectedCardIdentity(
          card,
          role,
          currentPage,
          requirementTerms
        );
        if (this.usedJobs.has(selected.canonicalJobId)) continue;
        this.usedJobs.add(selected.canonicalJobId);
        this.selectedJob = selected;
        return selected;
      }
    }
    throw new Error('No distinct unsaved real-provider job was available for this repeated run.');
  }

  private async activeRole(): Promise<string> {
    for (const role of TARGET_ROLES) {
      if (await this.roleButton(role).getAttribute('aria-current') === 'true') return role;
    }
    throw new Error('No target-role tab is active.');
  }

  private async activePage(): Promise<number> {
    const text = await this.jobWorkspace().locator('.pagination-row').getByText(/^Page /).innerText();
    const pageNumber = Number(text.match(/^Page (\d+) of/)?.[1]);
    if (!Number.isSafeInteger(pageNumber)) throw new Error('The active result page was unavailable.');
    return pageNumber;
  }

  private async expandCard(card: Locator): Promise<void> {
    const toggle = card.getByRole('button', { name: 'Toggle job details', exact: true });
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await expect(card.getByRole('heading', { name: 'Job Description', exact: true })).toBeVisible();
  }

  private async cardCanonicalDomIdentity(card: Locator): Promise<string> {
    const identity = await card.locator('xpath=ancestor::app-job-card')
      .getAttribute('data-demo-focus-id');
    expect(
      identity,
      'A result card did not expose its canonical job-derived DOM identity.'
    ).toMatch(/^job-card-[a-z0-9-]+$/);
    return identity as string;
  }

  private async readSelectedCardIdentity(
    card: Locator,
    role: string,
    page: number,
    requirementTerms: string[]
  ): Promise<SelectedJob> {
    const title = (await card.locator('.job-title').innerText()).trim();
    const company = (await card.locator('.job-company').innerText()).trim();
    await card.getByTestId('generate-documents-button').click();
    const selector = card.getByTestId('generation-evidence-selector');
    await expect(selector).toBeVisible();
    await expect(this.page.getByTestId('generation-evidence-selector')).toHaveCount(1);
    const canonicalJobId = (await this.definitionValue(
      selector,
      'Job reference'
    ).innerText()).trim();
    const providerDisplay = (await this.definitionValue(
      selector,
      'Provider'
    ).innerText()).trim();
    expect(
      canonicalJobId,
      'The selected result omitted its canonical job identity.'
    ).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(providerDisplay, 'The selected result omitted its provider identity.')
      .not.toBe('');
    const domIdentity = await this.cardCanonicalDomIdentity(card);
    expect(
      domIdentity,
      'The selected card did not match its canonical job reference.'
    ).toBe(this.jobCardFocusId(canonicalJobId));
    const knownCanonicalJobId = this.canonicalJobIdsByDomIdentity.get(domIdentity);
    expect(
      knownCanonicalJobId === undefined || knownCanonicalJobId === canonicalJobId,
      'Two canonical job references collided on the selected card identity.'
    ).toBe(true);
    this.canonicalJobIdsByDomIdentity.set(domIdentity, canonicalJobId);
    await selector.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(selector).toHaveCount(0);
    return {
      canonicalJobId,
      provider: providerDisplay,
      providerDisplay,
      title,
      company,
      role,
      page,
      requirementTerms
    };
  }

  private async jobRequirementTerms(card: Locator): Promise<string[]> {
    const readMore = card.getByRole('button', { name: 'Read more', exact: true });
    const expandedHere = await readMore.isVisible().catch(() => false);
    if (expandedHere) await readMore.click();
    const description = (await card.locator('.job-description').innerText())
      .toLocaleLowerCase('en-GB');
    if (expandedHere) {
      await card.getByRole('button', { name: 'Show less', exact: true }).click();
    }
    return JOB_REQUIREMENT_TERMS.filter(term =>
      description.includes(term.toLocaleLowerCase('en-GB'))
    );
  }

  private definitionValue(container: Locator, label: string): Locator {
    return container.locator('dt')
      .getByText(label, { exact: true })
      .locator('xpath=..')
      .locator('dd');
  }

  private jobCardFocusId(canonicalJobId: string): string {
    return `job-card-${this.slug(canonicalJobId)}`;
  }

  private slug(value: string): string {
    return value.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item';
  }

  private requiredIdentity(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`The selected job omitted its ${label} identity.`);
    }
    return value.trim();
  }

  private selectedJobCard(): Locator {
    const selected = this.requireSelectedJob();
    return this.jobWorkspace()
      .locator(`app-job-card[data-demo-focus-id="${this.jobCardFocusId(
        selected.canonicalJobId
      )}"]`)
      .getByTestId('job-result-card');
  }

  private requireSelectedJob(): SelectedJob {
    if (!this.selectedJob) throw new Error('No real-provider job has been selected.');
    return this.selectedJob;
  }

  private async saveSelectedJob(selected: SelectedJob): Promise<void> {
    const card = this.selectedJobCard();
    const responsePromise = this.waitForResponse('POST', '/api/jobs/applications');
    await card.getByTestId('track-application-button').click();
    const response = await responsePromise;
    this.assertSuccessful(response, `saving ${selected.title} to applications`);
    const request = response.request().postDataJSON() as Record<string, unknown>;
    expect(request).toMatchObject({
      canonicalJobId: selected.canonicalJobId,
      jobId: selected.canonicalJobId,
      jobTitle: selected.title,
      companyName: selected.company
    });
    selected.provider = this.requiredIdentity(request.provider, 'provider');
    selected.providerJobId = this.requiredIdentity(
      request.externalJobId,
      'provider job'
    );
    const record = await response.json() as Record<string, unknown>;
    selected.applicationId = this.requiredIdentity(record.id, 'application');
    expect(record).toMatchObject({
      canonicalJobId: selected.canonicalJobId,
      provider: selected.provider,
      externalJobId: selected.providerJobId,
      jobTitle: selected.title,
      companyName: selected.company
    });
    await expect(card.getByText('Saved to applications', { exact: true })).toBeVisible();
  }

  private async openAndPopulateEvidenceSelector(
    selected: SelectedJob,
    changeSelection = true
  ): Promise<Locator> {
    const card = this.selectedJobCard();
    await card.getByTestId('generate-documents-button').click();
    const selector = card.getByTestId('generation-evidence-selector');
    await expect(selector).toBeVisible();
    await expect(this.page.getByTestId('generation-evidence-selector')).toHaveCount(1);
    await expect(selector).toContainText(selected.title);
    await expect(selector).toContainText(selected.company);
    await expect(selector.locator('dl').getByText('Provider', { exact: true })).toBeVisible();
    const provider = this.definitionValue(selector, 'Provider');
    await expect(provider).toHaveText(selected.providerDisplay ?? selected.provider);
    const reference = this.definitionValue(selector, 'Job reference');
    await expect(reference).toHaveText(selected.canonicalJobId);

    await expect(
      selector.getByRole('heading', { name: 'CV evidence', exact: true })
    ).toBeVisible();
    await expect(
      selector.getByRole('heading', { name: 'Cover letter evidence', exact: true })
    ).toBeVisible();
    if (changeSelection) {
      await this.selectEvidence(selector, PROJECT_TITLE);
      await this.selectEvidence(selector, QUALIFICATION_TITLE);
    }
    await expect(
      selector.getByRole('button', { name: 'Generate from selected evidence', exact: true })
    ).toBeEnabled();
    return selector;
  }

  private async selectEvidence(selector: Locator, heading: string): Promise<void> {
    for (const purpose of ['CV evidence', 'Cover letter evidence']) {
      const panel = selector.locator('section.purpose-panel').filter({
        hasText: purpose,
      });
      const checkbox = panel.locator('label.evidence-choice')
        .filter({ hasText: heading })
        .getByRole('checkbox');
      await expect(checkbox, `${heading} was not eligible for ${purpose}.`).toBeVisible();
      if (!(await checkbox.isChecked())) await checkbox.check();
    }
  }

  private async expectEvidenceChecked(selector: Locator, heading: string): Promise<void> {
    for (const purpose of ['CV evidence', 'Cover letter evidence']) {
      const panel = selector.locator('section.purpose-panel').filter({
        hasText: purpose,
      });
      await expect(
        panel.locator('label.evidence-choice')
          .filter({ hasText: heading })
          .getByRole('checkbox')
      ).toBeChecked();
    }
  }

  private async startGeneration(duplicateClick: boolean): Promise<GenerationStartMonitor> {
    const selector = this.selectedJobCard().getByTestId('generation-evidence-selector');
    const generate = selector.getByRole(
      'button',
      { name: 'Generate from selected evidence', exact: true }
    );
    const idempotencyKeys = new Set<string>();
    let operationPathname: string | undefined;
    let blockedDistinctStarts = 0;
    const guardStart = async (route: Route): Promise<void> => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (
        request.method() === 'POST'
        && /^\/api\/v1\/document-generation\/saved-jobs\/[^/]+\/operations$/.test(pathname)
      ) {
        const idempotencyKey = request.headers()['idempotency-key']?.trim();
        if (!idempotencyKey) {
          blockedDistinctStarts += 1;
          await route.abort('blockedbyclient');
          return;
        }
        if (
          (operationPathname !== undefined && operationPathname !== pathname)
          || (idempotencyKeys.size > 0 && !idempotencyKeys.has(idempotencyKey))
        ) {
          blockedDistinctStarts += 1;
          await route.abort('blockedbyclient');
          return;
        }
        operationPathname ??= pathname;
        idempotencyKeys.add(idempotencyKey);
      }
      await route.continue();
    };
    const generationRoute =
      '**/api/v1/document-generation/saved-jobs/*/operations';
    await this.page.route(generationRoute, guardStart);
    try {
      const accepted = this.waitForMatchingResponse(response =>
        response.request().method() === 'POST'
        && /^\/api\/v1\/document-generation\/saved-jobs\/[^/]+\/operations$/
          .test(new URL(response.url()).pathname)
      );
      if (duplicateClick) {
        await generate.evaluate(element => {
          element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });
      } else {
        await generate.click();
      }
      const response = await accepted;
      expect(response.status(), 'A new live generation must be accepted asynchronously.').toBe(202);
      const body = await response.json() as { operationId?: unknown };
      expect(body.operationId, 'The accepted generation omitted its operation ID.')
        .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      const card = this.selectedJobCard();
      await expect(card.getByText('Processing', { exact: true })).toHaveCount(1);
      await expect(card.getByTestId('cancel-generation-button')).toBeVisible();
      let stopped = false;
      return {
        operationId: body.operationId as string,
        assertSingleStart: () => {
          expect(
            blockedDistinctStarts,
            'Duplicate Generate clicks attempted a second operation with a different idempotency key.'
          ).toBe(0);
          expect(
            idempotencyKeys.size,
            'The live journey did not use exactly one replay-safe generation idempotency key.'
          ).toBe(1);
          expect(
            operationPathname,
            'The live journey did not bind its generation replay to one saved job.'
          ).toMatch(
            /^\/api\/v1\/document-generation\/saved-jobs\/[^/]+\/operations$/
          );
        },
        stop: async () => {
          if (stopped) return;
          stopped = true;
          await this.page.unroute(generationRoute, guardStart);
        }
      };
    } catch (error) {
      await this.page.unroute(generationRoute, guardStart);
      throw error;
    }
  }

  private assertSingleApproval(
    approvals: Response[],
    operationId: string
  ): void {
    expect(
      approvals,
      'The probe did not issue exactly one approval request.'
    ).toHaveLength(1);
    const approval = approvals[0];
    expect(
      new URL(approval.url()).pathname,
      'The probe approved a different generation operation.'
    ).toBe(`/api/v1/document-generation/operations/${operationId}/approve`);
    this.assertSuccessful(approval, 'approving the single probe generation');
  }

  private async reloadAndRestoreSelectedJob(): Promise<void> {
    const selected = this.requireSelectedJob();
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.expectDashboard(this.page, {
      email: 'synthetic@example.invalid',
      displayName: 'Alex Taylor',
    });
    await this.navigateToSelectedJob(selected);
    const card = this.selectedJobCard();
    const success = card.getByText(
      'CV and Cover Letter generated successfully',
      { exact: true }
    );
    if (!(await success.isVisible().catch(() => false))) {
      await expect(card.getByText('Processing', { exact: true })).toHaveCount(1);
      await expect(card.getByTestId('cancel-generation-button')).toBeVisible();
    }
  }

  private async waitForGenerationSuccess(): Promise<void> {
    const card = this.selectedJobCard();
    const success = card.getByText(
      'CV and Cover Letter generated successfully',
      { exact: true }
    );
    const error = card.locator('.generation-error');
    await Promise.race([
      success.waitFor({ state: 'visible', timeout: GENERATION_TIMEOUT_MS }),
      error.waitFor({ state: 'visible', timeout: GENERATION_TIMEOUT_MS }).then(async () => {
        const message = (await error.innerText()).trim();
        throw new Error(`Live document generation failed safely: ${message}`);
      }),
    ]);
    await expect(card.getByText('Documents prepared', { exact: true })).toBeVisible();
    await expect(card.getByTestId('cancel-generation-button')).toHaveCount(0);
  }

  private async downloadSelectedDocuments(runNumber: number): Promise<void> {
    const selected = this.requireSelectedJob();
    const downloads = this.selectedJobCard().locator('.generated-downloads');
    await expect(downloads).toBeVisible();
    for (const [heading, kind] of [
      ['CV', 'cv'],
      ['Cover Letter', 'cover-letter'],
    ] as const) {
      const group = downloads.getByRole('heading', { name: heading, exact: true }).locator('..');
      for (const format of ['docx', 'pdf'] as const) {
        const event = this.page.waitForEvent('download');
        await group.getByRole('button', {
          name: `Download ${format.toUpperCase()}`,
          exact: true,
        }).click();
        await this.artifacts.saveDocument(
          await event,
          runNumber,
          kind,
          format,
          {
            jobTitle: selected.title,
            company: selected.company,
            projectTitle: PROJECT_TITLE,
            qualificationTitle: QUALIFICATION_TITLE,
            jobRequirementTerms: selected.requirementTerms
          }
        );
      }
    }
  }

  private async reloadAndVerifyPersistence(runNumber: number): Promise<void> {
    const selected = this.requireSelectedJob();
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.expectDashboard(this.page, {
      email: 'synthetic@example.invalid',
      displayName: 'Alex Taylor',
    });

    await this.page.getByTestId('workspace-tab-applications').click();
    const applications = this.page.getByTestId('applications-workspace');
    await expect(applications).toBeVisible();
    const refreshApplications = applications.getByRole(
      'button',
      { name: 'Refresh', exact: true }
    );
    await expect(refreshApplications).toBeEnabled();
    const applicationRefresh = this.waitForResponse('GET', '/api/jobs/applications');
    await refreshApplications.click();
    const applicationResponse = await applicationRefresh;
    this.assertSuccessful(applicationResponse, 'refreshing the selected application');
    const records = await applicationResponse.json() as Array<Record<string, unknown>>;
    const authoritative = records.find(
      record => record.id === selected.applicationId
    );
    expect(
      authoritative,
      `The authoritative application response lost ${selected.applicationId}.`
    ).toBeDefined();
    expect(authoritative).toMatchObject({
      id: selected.applicationId,
      canonicalJobId: selected.canonicalJobId,
      provider: selected.provider,
      externalJobId: selected.providerJobId,
      jobTitle: selected.title,
      companyName: selected.company
    });
    selected.cvDocumentId = this.requiredIdentity(
      authoritative?.cvDocumentId,
      'CV document'
    );
    selected.coverLetterDocumentId = this.requiredIdentity(
      authoritative?.coverLetterDocumentId,
      'cover-letter document'
    );
    const application = this.applicationCard(applications, selected);
    await expect(application).toBeVisible({ timeout: 60_000 });
    await expect(application).toContainText(selected.title);
    await expect(application).toContainText(selected.company);
    await expect(application).toContainText('Documents prepared');
    await this.artifacts.screenshot(this.page, `run-${runNumber}-application-after-reload`);

    await this.page.getByTestId('workspace-tab-documents').click();
    const documents = this.page.getByTestId('documents-workspace');
    await expect(documents).toBeVisible();
    await expect(this.page.getByText('Real OpenAI generation', { exact: true })).toBeVisible();
    await expect(
      this.documentCard(documents, selected.cvDocumentId, 'CV', selected)
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      this.documentCard(
        documents,
        selected.coverLetterDocumentId,
        'cover letter',
        selected
      )
    ).toBeVisible({ timeout: 60_000 });
    await this.artifacts.screenshot(this.page, `run-${runNumber}-documents-after-reload`);

    await this.navigateToSelectedJob(selected);
    const card = this.selectedJobCard();
    await expect(card.getByText('Documents prepared', { exact: true })).toBeVisible();
    await expect(card.locator('.generated-downloads')).toBeVisible({ timeout: 60_000 });
  }

  private async navigateToSelectedJob(selected: SelectedJob): Promise<void> {
    await this.openSearchWorkspace();
    await this.expectRealProviders();
    await this.selectRole(selected.role);
    const candidatePages = Array.from(new Set([selected.page, 1, 2]));
    for (const pageNumber of candidatePages) {
      try {
        await this.navigateToPage(pageNumber);
      } catch {
        continue;
      }
      const card = this.selectedJobCard();
      if (!(await card.isVisible().catch(() => false))) continue;
      selected.page = pageNumber;
      await this.expandCard(card);
      return;
    }
    throw new Error(
      `The canonical job ${selected.canonicalJobId} was not present on its bounded retained result pages.`
    );
  }

  private applicationCard(workspace: Locator, selected: StabilisationJobRecord): Locator {
    const applicationId = this.requiredIdentity(
      selected.applicationId,
      'application'
    );
    return workspace.locator(
      `[data-testid="application-card"][data-demo-focus-id="application-${
        this.slug(applicationId)
      }"]`
    );
  }

  private documentCard(
    workspace: Locator,
    documentId: string | undefined,
    label: string,
    selected: StabilisationJobRecord
  ): Locator {
    const identity = this.requiredIdentity(documentId, label);
    const card = workspace.locator(
      `[data-testid="document-card"][data-demo-focus-id="document-${
        this.slug(identity)
      }"]`
    );
    return card.filter({ hasText: `${selected.title} - ${selected.company}` });
  }

  private waitForResponse(method: string, pathname: string): Promise<Response> {
    return this.waitForMatchingResponse(response =>
      response.request().method() === method
      && new URL(response.url()).pathname === pathname
    );
  }

  private waitForMatchingResponse(predicate: (response: Response) => boolean): Promise<Response> {
    return this.page.waitForResponse(predicate, { timeout: 60_000 });
  }

  private assertSuccessful(response: Response, action: string): void {
    expect(
      response.ok(),
      `The application returned HTTP ${response.status()} while ${action}.`
    ).toBe(true);
  }
}
