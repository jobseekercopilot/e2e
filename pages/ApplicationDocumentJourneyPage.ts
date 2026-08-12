import { expect, type Browser, type BrowserContext, type Locator, type Page, type Response } from '@playwright/test';
import type { NamedStateIdentity } from './StabilisationPage';
import { PUBLIC_NAMED_STATE_PASSWORD } from '../support/demo-data';
import { applicationDocumentFixtures, type ApplicationDocumentFixture } from '../support/application-document-fixtures';
import { e2eConfig } from '../support/config';
import { demoCursor } from '../support/demo-cursor';

export type DocumentChoice = 'GENERATE' | 'UPLOAD' | 'OMIT';
export type DocumentPurpose = 'CV' | 'COVER_LETTER';

interface ApplicationRecord {
  id: string;
  status: string;
  jobTitle?: string;
  companyName?: string;
  cvDocumentReference?: DocumentReference | null;
  coverLetterDocumentReference?: DocumentReference | null;
  [key: string]: unknown;
}

interface DocumentReference {
  documentId?: string;
  sourceType?: string;
  originalContentSha256?: string;
  contentSha256?: string;
  selectedAt?: string;
  version?: number;
  [key: string]: unknown;
}

export interface PreferredJob {
  title: string;
  company: string;
  canonicalJobId?: string;
}

interface UploadOperation {
  operationId?: string;
  applicationId?: string;
  documentId?: string;
  documentType?: string;
  state?: string;
  [key: string]: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERATION_EVIDENCE_TITLE = 'Synthetic application document project';
const FORBIDDEN_CONTENT_KEYS = new Set([
  'content', 'extractedText', 'originalFileName', 'storageKey', 'bucket',
  'objectKey', 'documentBytes', 'downloadUrl', 'accessToken'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ApplicationDocumentJourneyPage {
  private selectedCard?: Locator;
  private applicationId?: string;
  private walletBefore?: number;
  private readonly uploadResponses: Response[] = [];
  private readonly uploadPayloads: UploadOperation[] = [];
  private readonly selectedUploadFixtures = new Map<DocumentPurpose, ApplicationDocumentFixture>();
  private readonly pendingResponseReads: Promise<void>[] = [];
  private generationStarts = 0;

  constructor(private readonly page: Page, private readonly baseUrl: string) {
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      const isUploadCommand = /^\/api\/v1\/document-generation\/applications\/[^/]+\/document-uploads$/.test(pathname);
      const isUploadStatus = /^\/api\/v1\/document-generation\/application-document-uploads\/[^/]+$/.test(pathname);
      if (!isUploadCommand && !isUploadStatus) return;
      this.uploadResponses.push(response);
      this.pendingResponseReads.push(response.json().then(body => {
        if (isRecord(body)) this.uploadPayloads.push(body as UploadOperation);
      }).catch(() => undefined));
    });
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (request.method() === 'POST'
        && /^\/api\/v1\/document-generation\/saved-jobs\/[^/]+\/operations$/.test(pathname)) {
        this.generationStarts += 1;
      }
    });
  }

  async startJourney(entryPoint: 'ADD' | 'GENERATE', preferredJob?: PreferredJob): Promise<void> {
    this.walletBefore = await this.walletBalance();
    await this.page.goto('/dashboard');
    await this.demoClick(this.page.getByTestId('workspace-tab-search'));
    await this.ensureSearchResults(entryPoint, preferredJob);
    await expect(this.page.getByTestId('job-result-card').first()).toBeVisible({ timeout: 30_000 });
    this.selectedCard = await this.openJobCard(entryPoint, preferredJob);
    const action = this.selectedCard.getByTestId(
      entryPoint === 'ADD' ? 'track-application-button' : 'generate-documents-button'
    );
    if (entryPoint === 'GENERATE') await this.ensureConfirmedGenerationEvidence();
    const createsApplication = await this.selectedCard.getByTestId('track-application-button')
      .isVisible().catch(() => false);
    const createResponse = createsApplication
      ? this.page.waitForResponse(response =>
        response.request().method() === 'POST'
        && new URL(response.url()).pathname === '/api/jobs/applications')
      : undefined;
    if (!createsApplication) this.applicationId = await this.applicationIdForCard(this.selectedCard);
    await expect(action).toBeEnabled();
    await this.demoClick(action);
    if (createResponse) {
      const response = await createResponse;
      expect(response.ok(), 'The tracked application must be created before document selection.').toBe(true);
      const body: unknown = await response.json();
      if (!isRecord(body) || typeof body.id !== 'string' || !UUID.test(body.id)) {
        throw new Error('Application creation returned no valid application identifier.');
      }
      this.applicationId = body.id;
    }
    await expect(this.page.getByTestId('application-document-choice')).toBeVisible();
  }

  private async ensureSearchResults(entryPoint: 'ADD' | 'GENERATE', preferredJob?: PreferredJob): Promise<void> {
    const cards = this.page.getByTestId('job-result-card');
    if (entryPoint === 'ADD' && await cards.first().isVisible().catch(() => false)) return;
    if (preferredJob) {
      const preferred = this.preferredJobCard(cards, preferredJob);
      if (await preferred.isVisible().catch(() => false)) return;
    }

    const findJobs = this.page.getByRole('button', { name: 'Find jobs', exact: true });
    if (await this.page.getByTestId('search-setup-prompt').isVisible().catch(() => false)) {
      // Named states may retain a partially completed profile. Add the minimum
      // valid search preferences through the UI so this Story remains
      // focused on application documents rather than depending on another flow.
      await this.page.getByRole('button', { name: 'Edit Location and commute', exact: true }).click();
      const location = this.page.getByLabel('Town or postcode', { exact: true });
      await location.fill('RG1 1AA');
      const locationOption = this.page.locator('#profile-location-options button').first();
      await expect(locationOption).toBeVisible();
      await locationOption.click();
      await this.saveProfileSection();

      const workplace = await this.openProfileGroup('Edit Working preferences', 'Workplace');
      await workplace.getByLabel('Remote', { exact: true }).check();
      await this.saveProfileSection();
    }

    if (entryPoint === 'GENERATE' && !preferredJob) {
      // DEMO_READY intentionally owns all nine core fixture jobs. Search Leeds
      // so the untracked governed apprenticeship vacancy is available for a
      // fresh generation journey rather than selecting a progressed application.
      await this.page.getByRole('button', { name: 'Edit Location and commute', exact: true }).click();
      const location = this.page.getByLabel('Town or postcode', { exact: true });
      await location.fill('LS1 1UR');
      const locationOption = this.page.locator('#profile-location-options button').first();
      await expect(locationOption).toBeVisible();
      await locationOption.click();
      await this.saveProfileSection();
    }

    await expect(findJobs).toBeEnabled();
    await expect(this.page.getByTestId('job-results-workspace')).toBeVisible();
    const searchResponse = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/jobs/search');
    await findJobs.click();
    const completedSearch = await searchResponse;
    expect(completedSearch.ok(), 'The job search must complete successfully.').toBe(true);
    await expect(this.page.getByTestId('job-results-workspace')
      .getByRole('button', { name: 'Refresh', exact: true }))
      .toBeEnabled({ timeout: 30_000 });
  }

  private async openProfileGroup(editLabel: string, groupLabel: string): Promise<Locator> {
    const edit = this.page.getByRole('button', { name: editLabel, exact: true });
    const group = this.page.getByRole('group', { name: groupLabel, exact: true });
    await edit.click();
    try {
      await group.waitFor({ state: 'visible', timeout: 3_000 });
    } catch {
      // A just-saved profile can rerender once after the edit click. Reopen the
      // section once after that bounded transition.
      await edit.click();
      await group.waitFor({ state: 'visible', timeout: 10_000 });
    }
    return group;
  }

  private async saveProfileSection(): Promise<void> {
    const save = this.page.getByRole('button', { name: 'Save this section', exact: true });
    const response = this.page.waitForResponse(candidate =>
      candidate.request().method() === 'PATCH'
      && new URL(candidate.url()).pathname === '/api/auth/profile');
    await save.click();
    expect((await response).ok(), 'The search-profile section must save before continuing.').toBe(true);
    await expect(save).toBeHidden();
  }

  private async ensureConfirmedGenerationEvidence(): Promise<void> {
    const summary = this.page.getByTestId('profile-evidence-summary');
    await summary.getByRole('button', { name: 'Manage experience & achievements', exact: true }).click();
    const dialog = this.page.locator('#experience-evidence-dialog');
    await expect(dialog).toBeVisible();
    const confirmedCard = dialog.locator('article.evidence-card')
      .filter({ hasText: 'User confirmed' })
      .first();
    if (await confirmedCard.isVisible().catch(() => false)) {
      await dialog.getByRole('button', { name: 'Close Experience and Evidence manager' }).click();
      await expect(dialog).toBeHidden();
      return;
    }
    let card = dialog.locator('article.evidence-card').filter({ hasText: GENERATION_EVIDENCE_TITLE });
    if (await card.getByText('User confirmed', { exact: true }).isVisible().catch(() => false)) {
      await dialog.getByRole('button', { name: 'Close Experience and Evidence manager' }).click();
      await expect(dialog).toBeHidden();
      return;
    }

    await dialog.getByRole('button', { name: /Add experience or achievement/i }).click();
    const form = dialog.locator('form');
    await expect(form).toBeVisible();
    await form.locator('select[name="category"]').selectOption('PROJECT');
    await form.getByLabel('Project title', { exact: true }).fill(GENERATION_EVIDENCE_TITLE);
    await form.getByLabel('Your role in the project (optional)', { exact: true }).fill('Software developer');
    await form.locator('textarea[name="description"]').fill(
      'Built a fully synthetic Java and Angular workflow with secure REST APIs, automated tests, accessible interfaces and deterministic document-generation integration.'
    );
    await form.locator('input[name="startDate"]').fill('2025-01-01');
    await form.locator('input[name="endDate"]').fill('2026-07-01');

    const created = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/auth/evidence');
    await form.getByRole('button', { name: 'Save as draft', exact: true }).click();
    expect((await created).ok(), 'Synthetic generation evidence must be saved.').toBe(true);

    card = dialog.locator('article.evidence-card').filter({ hasText: GENERATION_EVIDENCE_TITLE });
    await expect(card).toBeVisible();
    const confirmed = this.page.waitForResponse(response =>
      response.request().method() === 'POST'
      && /^\/api\/auth\/evidence\/[^/]+\/confirm$/.test(new URL(response.url()).pathname));
    await card.getByRole('button', { name: 'Review & confirm', exact: true }).click();
    expect((await confirmed).ok(), 'Synthetic generation evidence must be user-confirmed.').toBe(true);
    await expect(card.getByText('User confirmed', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close Experience and Evidence manager' }).click();
    await expect(dialog).toBeHidden();
  }

  async chooseDocuments(choices: Record<DocumentPurpose, DocumentChoice>): Promise<void> {
    const fixtures = applicationDocumentFixtures();
    await this.choose('CV', choices.CV, fixtures.cvPdf);
    await this.choose('COVER_LETTER', choices.COVER_LETTER, fixtures.coverPdf);
    await this.page.getByTestId('application-document-choice')
      .getByRole('button', { name: 'Continue', exact: true })
      .click();
  }

  async chooseSafeDocxForCv(): Promise<void> {
    const fixtures = applicationDocumentFixtures();
    await this.choose('CV', 'UPLOAD', fixtures.safeDocx);
    await this.choose('COVER_LETTER', 'OMIT', fixtures.coverPdf);
    await this.page.getByTestId('application-document-choice')
      .getByRole('button', { name: 'Continue', exact: true })
      .click();
  }

  async chooseNamedCvFixture(fixtureName: string): Promise<void> {
    const fixture = this.fixture(fixtureName);
    await this.choose('CV', 'UPLOAD', fixture);
    await this.choose('COVER_LETTER', 'OMIT', applicationDocumentFixtures().coverPdf);
    await this.page.getByTestId('application-document-choice')
      .getByRole('button', { name: 'Continue', exact: true })
      .click();
  }

  async assertCvFixtureRejectedByBrowser(fixtureName: string): Promise<void> {
    const fixture = this.fixture(fixtureName);
    const commandsBefore = this.uploadResponses.filter(response =>
      response.request().method() === 'POST').length;
    await this.choose('CV', 'UPLOAD', fixture);
    await this.choose('COVER_LETTER', 'OMIT', applicationDocumentFixtures().coverPdf);
    const selector = this.page.getByTestId('application-document-choice');
    await expect(selector.getByRole('alert')).toHaveText(
      'Choose a non-empty PDF or Microsoft Word .docx file no larger than 10 MiB.'
    );
    await expect(selector.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    expect(this.uploadResponses.filter(response => response.request().method() === 'POST'))
      .toHaveLength(commandsBefore);
    const application = await this.currentApplication();
    expect(application.cvDocumentReference ?? null).toBeNull();
  }

  async assertCvUploadSafelyRejected(): Promise<void> {
    const card = this.selectedJobCard();
    const message = card.getByText(
      'The uploaded document did not pass secure processing.',
      { exact: true }
    );
    await expect(message).toBeVisible({ timeout: 90_000 });
    await Promise.all(this.pendingResponseReads);
    const rejected = [...this.uploadPayloads].reverse().find(payload =>
      payload.applicationId === this.requireApplicationId()
      && payload.documentType === 'CV'
      && payload.state === 'REJECTED');
    expect(rejected, 'The hostile upload must reach a terminal rejected operation.').toBeTruthy();
    expect(rejected?.documentId).toBeUndefined();
    const application = await this.currentApplication();
    expect(application.cvDocumentReference ?? null).toBeNull();
    const status = card.getByRole('article').filter({ hasText: 'The uploaded document did not pass secure processing.' });
    await expect(status.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
    await expect(status.getByRole('button', { name: 'Choose another file', exact: true })).toBeVisible();
    await expect(status.getByRole('button', { name: 'Skip', exact: true })).toBeVisible();
    const visibleText = await status.innerText();
    expect(visibleText).not.toMatch(/(?:Exception|stack trace|\bat\s+[\w.$]+\([^)]*:\d+\))/i);
  }

  async recoverRejectedCvWithSafeDocx(): Promise<void> {
    const card = this.selectedJobCard();
    const status = card.getByRole('article').filter({ hasText: 'The uploaded document did not pass secure processing.' });
    await status.getByRole('button', { name: 'Choose another file', exact: true }).click();
    await expect(this.page.getByTestId('application-document-choice')).toBeVisible();
    await this.chooseSafeDocxForCv();
    await this.completeUploads(['CV']);
    await this.assertApplication({CV: 'UPLOAD', COVER_LETTER: 'OMIT'});
  }

  async completeUploads(expectedPurposes: DocumentPurpose[]): Promise<void> {
    for (const purpose of expectedPurposes) {
      const label = purpose === 'CV' ? 'CV' : 'Cover letter';
      await expect(this.selectedJobCard().getByText(`${label} uploaded and linked.`, { exact: true }))
        .toBeVisible({ timeout: 90_000 });
    }
    await Promise.all(this.pendingResponseReads);
    const completed = this.completedUploads();
    expect(new Set(completed.map(value => value.documentType)))
      .toEqual(new Set(expectedPurposes));
    for (const operation of completed) {
      expect(operation.operationId).toMatch(UUID);
      expect(operation.applicationId).toBe(this.requireApplicationId());
      expect(operation.documentId).toMatch(UUID);
      expect(operation.state).toBe('COMPLETED');
    }
  }

  async completeGeneration(
    expectedPurposes: DocumentPurpose[],
    preferredEvidence: string | Partial<Record<DocumentPurpose, string[]>> = GENERATION_EVIDENCE_TITLE
  ): Promise<void> {
    const selector = this.page.getByTestId('generation-evidence-selector');
    await expect(selector).toBeVisible({ timeout: 30_000 });
    const advert = selector.locator('textarea').first();
    if (await advert.isVisible().catch(() => false)) {
      const current = await advert.inputValue();
      if (current.trim().length < 200) {
        await advert.fill('Synthetic complete software engineering job advert for deterministic fixture-backed generation. '.repeat(4));
      }
    }
    const confirmation = selector.getByLabel(/I have reviewed this and confirm/i);
    if (await confirmation.isVisible().catch(() => false)) await this.demoCheck(confirmation);
    const purposePanels = selector.locator('.purpose-panel');
    await expect(purposePanels).toHaveCount(expectedPurposes.length);
    for (let index = 0; index < expectedPurposes.length; index += 1) {
      const evidenceChoices = purposePanels.nth(index).locator('label.evidence-choice');
      await expect(evidenceChoices.first()).toBeVisible();
      const purpose = expectedPurposes[index];
      const preferredTitles = typeof preferredEvidence === 'string'
        ? [preferredEvidence]
        : (preferredEvidence[purpose] ?? []);
      let selectedCount = 0;
      for (const title of preferredTitles) {
        const preferredChoice = evidenceChoices.filter({hasText: title}).first();
        if (await preferredChoice.count() === 0) continue;
        await this.demoCheck(preferredChoice.locator('input[type="checkbox"]'));
        selectedCount += 1;
      }
      if (selectedCount === 0) {
        await this.demoCheck(evidenceChoices.first().locator('input[type="checkbox"]'));
      }
    }

    const startsBefore = this.generationStarts;
    const action = selector.getByRole('button', { name: /^Generate .*AI Credit/ });
    await expect(action).toBeEnabled();
    await this.demoClick(action);
    const selectedCard = this.selectedJobCard();
    const generationProgress = selectedCard.getByTestId('generation-progress');
    if (e2eConfig.demoRecording) {
      await expect(generationProgress).toBeVisible({ timeout: 10_000 });
      await this.frameSelectedJobHeader(generationProgress);
      await this.page.waitForTimeout(1_200);
    }
    const expectedLabel = expectedPurposes.length === 2
      ? /CV and cover letter generated successfully/i
      : new RegExp(`${expectedPurposes[0] === 'CV' ? 'CV' : 'Cover letter'} generated successfully`, 'i');
    const completionState = this.selectedJobCard().getByText(expectedLabel).first()
      .or(this.page.locator('#toast-notification').getByText(expectedLabel).first())
      .or(this.selectedJobCard().getByText('Documents prepared', { exact: true }));
    await expect(completionState.first()).toBeVisible({ timeout: 12 * 60_000 });
    if (e2eConfig.demoRecording) {
      const prepared = selectedCard.locator('.status-badge')
        .filter({ hasText: 'Documents prepared' })
        .first();
      await expect(prepared).toBeVisible({ timeout: 30_000 });
      await this.frameSelectedJobHeader(prepared);
      await this.page.waitForTimeout(900);
    }
    expect(this.generationStarts).toBe(startsBefore + 1);
  }

  private async demoClick(locator: Locator): Promise<void> {
    if (!e2eConfig.demoRecording) {
      await locator.click();
      return;
    }
    await locator.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(220);
    await demoCursor.click(locator);
  }

  private async demoCheck(locator: Locator): Promise<void> {
    if (!e2eConfig.demoRecording) {
      await locator.check();
      return;
    }
    if (await locator.isChecked()) return;
    await this.demoClick(locator);
    await expect(locator).toBeChecked();
  }

  private async frameSelectedJobHeader(focus: Locator): Promise<void> {
    const header = this.selectedJobCard().locator('.job-card-trigger');
    await header.evaluate(element => element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    }));
    await this.page.waitForTimeout(e2eConfig.demoScrollMs + 120);
    await demoCursor.moveTo(focus, { durationMs: 520 });
  }

  async assertApplication(choices: Record<DocumentPurpose, DocumentChoice>): Promise<void> {
    const record = await this.currentApplication();
    expect(record.id).toBe(this.requireApplicationId());
    const completed = this.completedUploads();
    for (const purpose of ['CV', 'COVER_LETTER'] as const) {
      const reference = purpose === 'CV'
        ? record.cvDocumentReference
        : record.coverLetterDocumentReference;
      const choice = choices[purpose];
      if (choice === 'OMIT') {
        expect(reference ?? null).toBeNull();
        continue;
      }
      expect(reference?.documentId).toMatch(UUID);
      expect(reference?.version).toBeGreaterThan(0);
      expect(reference?.selectedAt).toBeTruthy();
      expect(reference?.sourceType).toBe(choice === 'UPLOAD' ? 'UPLOADED' : 'GENERATED');
      if (choice === 'UPLOAD') {
        const operation = completed.find(value => value.documentType === purpose);
        expect(reference?.documentId).toBe(operation?.documentId);
        const expectedFixture = this.selectedUploadFixtures.get(purpose);
        if (!expectedFixture) throw new Error(`No selected ${purpose} upload fixture was recorded.`);
        expect(reference?.originalContentSha256).toBe(expectedFixture.sha256);
      }
    }
  }

  async assertUploadCreditAndBoundary(expectedUploads: number): Promise<void> {
    expect(await this.walletBalance()).toBe(this.walletBefore);
    expect(this.generationStarts, 'Upload-only choices must not start paid generation.').toBe(0);
    await this.assertUploadBoundary(expectedUploads);
  }

  async assertUploadBoundary(expectedUploads: number): Promise<void> {
    await Promise.all(this.pendingResponseReads);
    expect(this.completedUploads()).toHaveLength(expectedUploads);
    for (const payload of this.uploadPayloads) this.assertContentFree(payload);
    for (const response of this.uploadResponses) {
      expect(response.headers()['cache-control']).toContain('no-store');
    }
  }

  async assertSelectedGenerationSpentCredit(): Promise<void> {
    const after = await this.walletBalance();
    expect(this.generationStarts, 'Exactly one selected-output generation must start.').toBe(1);
    if (this.walletBefore !== undefined) {
      expect(after).toBeLessThan(this.walletBefore);
    } else {
      expect(after, 'The private-beta wallet surface must remain consistently unavailable.').toBeUndefined();
    }
  }

  async assertUploadedDownloadHeaders(purpose: DocumentPurpose): Promise<void> {
    const operation = this.completedUploads().find(value => value.documentType === purpose);
    if (!operation?.documentId) throw new Error(`No completed ${purpose} upload was recorded.`);
    const result = await this.page.evaluate(async ({documentId, fileType}) => {
      const metadataResponse = await fetch(`/api/v1/document-generation/documents/${documentId}/files/latest`);
      const metadata = await metadataResponse.json() as {
        pdf?: {downloadUrl?: string};
        docx?: {downloadUrl?: string};
      };
      const downloadUrl = fileType === 'DOCX'
        ? metadata.docx?.downloadUrl
        : metadata.pdf?.downloadUrl;
      if (!downloadUrl) throw new Error(`No ${fileType} download URL was returned.`);
      const downloadResponse = await fetch(downloadUrl);
      return {
        metadataStatus: metadataResponse.status,
        downloadStatus: downloadResponse.status,
        cacheControl: downloadResponse.headers.get('cache-control'),
        contentType: downloadResponse.headers.get('content-type'),
        contentDisposition: downloadResponse.headers.get('content-disposition'),
        nosniff: downloadResponse.headers.get('x-content-type-options')
      };
    }, {documentId: operation.documentId, fileType: operation.fileType});
    expect(result.metadataStatus).toBe(200);
    expect(result.downloadStatus).toBe(200);
    expect(result.cacheControl).toContain('private');
    expect(result.cacheControl).toContain('no-store');
    expect(result.contentType).toContain(operation.fileType === 'DOCX'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf');
    expect(result.contentDisposition).toMatch(/^attachment;/i);
    expect(result.nosniff).toBe('nosniff');
  }

  async assertReportingContentFree(): Promise<void> {
    const result = await this.page.evaluate(async () => {
      const response = await fetch('/api/v1/reports/summary');
      return {
        status: response.status,
        cacheControl: response.headers.get('cache-control'),
        nosniff: response.headers.get('x-content-type-options'),
        body: await response.json() as unknown
      };
    });
    expect(result.status).toBe(200);
    expect(result.cacheControl).toContain('private');
    expect(result.cacheControl).toContain('no-store');
    expect(result.nosniff).toBe('nosniff');
    this.assertContentFree(result.body);
  }

  async assertSecondOwnerDenied(
    browser: Browser,
    secondIdentity: NamedStateIdentity
  ): Promise<void> {
    const operationId = this.completedUploads()[0]?.operationId;
    if (!operationId) throw new Error('No owner-scoped upload operation was available.');
    const context = await browser.newContext({ baseURL: this.baseUrl });
    try {
      const secondPage = await context.newPage();
      await this.signIn(secondPage, secondIdentity);
      const result = await secondPage.evaluate(async ({ operationId, applicationId }) => {
        const operation = await fetch(`/api/v1/document-generation/application-document-uploads/${operationId}`);
        const applications = await fetch('/api/jobs/applications');
        return {
          operationStatus: operation.status,
          applicationsStatus: applications.status,
          applicationsBody: await applications.text(),
          applicationId
        };
      }, { operationId, applicationId: this.requireApplicationId() });
      expect([403, 404]).toContain(result.operationStatus);
      expect(result.applicationsStatus).toBe(200);
      expect(result.applicationsBody).not.toContain(result.applicationId);
    } finally {
      await context.close();
    }
  }

  private async openJobCard(
    entryPoint: 'ADD' | 'GENERATE',
    preferredJob?: PreferredJob
  ): Promise<Locator> {
    const cards = this.page.getByTestId('job-result-card');
    if (preferredJob) {
      const preferred = this.preferredJobCard(cards, preferredJob);
      await expect(
        preferred,
        `The search did not return ${preferredJob.title} at ${preferredJob.company}.`
      ).toBeVisible({ timeout: 30_000 });
      const toggle = preferred.getByRole('button', { name: 'Toggle job details', exact: true });
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
      const action = preferred.getByTestId(
        entryPoint === 'ADD' ? 'track-application-button' : 'generate-documents-button'
      );
      await expect(action).toBeVisible();
      return preferred;
    }
    const count = await cards.count();
    for (let index = 0; index < count; index += 1) {
      const card = cards.nth(index);
      if (!(await card.isVisible().catch(() => false))) continue;
      const toggle = card.getByRole('button', { name: 'Toggle job details', exact: true });
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
      const action = card.getByTestId(
        entryPoint === 'ADD' ? 'track-application-button' : 'generate-documents-button'
      );
      const actionBecameVisible = await action
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (actionBecameVisible) return card;
      if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click();
    }
    throw new Error(`The job search returned no ${entryPoint.toLowerCase()} application candidate.`);
  }

  private preferredJobCard(cards: Locator, preferredJob: PreferredJob): Locator {
    if (preferredJob.canonicalJobId) {
      if (!/^[A-Za-z0-9._:-]{1,128}$/.test(preferredJob.canonicalJobId)) {
        throw new Error('The preferred job exposed an unsafe canonical identity.');
      }
      return this.page
        .locator(`app-job-card[data-job-reference="${preferredJob.canonicalJobId}"]`)
        .getByTestId('job-result-card')
        .first();
    }
    return cards
      .filter({ hasText: preferredJob.title })
      .filter({ hasText: preferredJob.company })
      .first();
  }

  private async applicationIdForCard(card: Locator): Promise<string> {
    const jobTitle = (await card.locator('.job-title').innerText()).trim();
    const companyName = (await card.locator('.job-company').innerText()).trim();
    const body = await this.page.evaluate(async () => {
      const response = await fetch('/api/jobs/applications');
      if (!response.ok) throw new Error(`Application list failed with HTTP ${response.status}.`);
      return await response.json() as unknown;
    });
    const records: unknown[] = Array.isArray(body)
      ? body
      : isRecord(body) && Array.isArray(body.applications)
        ? body.applications
        : isRecord(body) && Array.isArray(body.content)
          ? body.content
          : [];
    const match = records.find(value => isRecord(value)
      && value.jobTitle === jobTitle
      && value.companyName === companyName);
    if (!isRecord(match) || typeof match.id !== 'string' || !UUID.test(match.id)) {
      throw new Error(`No owner-scoped application matched ${jobTitle} at ${companyName}.`);
    }
    return match.id;
  }

  private async choose(
    purpose: DocumentPurpose,
    choice: DocumentChoice,
    upload: ApplicationDocumentFixture
  ): Promise<void> {
    const selector = this.page.getByTestId('application-document-choice');
    const legend = purpose === 'CV' ? 'CV' : 'Cover letter';
    const fieldset = selector.getByRole('group', { name: legend, exact: true });
    const label = choice === 'OMIT' ? 'Not now' : choice === 'UPLOAD' ? 'Upload' : 'Generate';
    await fieldset.getByRole('radio', { name: new RegExp(`^${label}`) }).check();
    if (choice === 'UPLOAD') {
      this.selectedUploadFixtures.set(purpose, upload);
      await fieldset.locator('input[type="file"]').setInputFiles({
        name: upload.name,
        mimeType: upload.mimeType,
        buffer: upload.bytes
      });
    }
  }

  private fixture(name: string): ApplicationDocumentFixture {
    const selected = applicationDocumentFixtures()[name];
    if (!selected) throw new Error(`Unknown application document fixture: ${name}`);
    return selected;
  }

  private selectedJobCard(): Locator {
    if (!this.selectedCard) throw new Error('No job card has been selected.');
    return this.selectedCard;
  }

  private requireApplicationId(): string {
    if (!this.applicationId) throw new Error('No application has been created.');
    return this.applicationId;
  }

  private completedUploads(): UploadOperation[] {
    const byOperation = new Map<string, UploadOperation>();
    for (const payload of this.uploadPayloads) {
      if (payload.state === 'COMPLETED' && payload.operationId) byOperation.set(payload.operationId, payload);
    }
    return [...byOperation.values()];
  }

  private async currentApplication(): Promise<ApplicationRecord> {
    const body = await this.page.evaluate(async () => {
      const response = await fetch('/api/jobs/applications');
      if (!response.ok) throw new Error(`Applications request failed with HTTP ${response.status}.`);
      return await response.json() as unknown;
    });
    const records = Array.isArray(body)
      ? body
      : isRecord(body) && Array.isArray(body.applications)
        ? body.applications
        : isRecord(body) && Array.isArray(body.content)
          ? body.content
          : [];
    const record = records.find(value => isRecord(value) && value.id === this.requireApplicationId());
    if (!isRecord(record)) throw new Error('The created application was absent from the owner-scoped list.');
    return record as ApplicationRecord;
  }

  private async walletBalance(): Promise<number | undefined> {
    const body = await this.page.evaluate(async () => {
      const response = await fetch('/api/v1/payment/wallet');
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error(`Wallet request failed with HTTP ${response.status}.`);
      return await response.json() as unknown;
    });
    if (body === undefined) return undefined;
    if (!isRecord(body) || typeof body.balanceTokens !== 'number') {
      throw new Error('Wallet response did not contain a numeric balanceTokens value.');
    }
    return body.balanceTokens;
  }

  private assertContentFree(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) this.assertContentFree(item);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      expect(FORBIDDEN_CONTENT_KEYS.has(key), `Upload response exposed forbidden field ${key}.`).toBe(false);
      this.assertContentFree(child);
    }
  }

  private async signIn(page: Page, identity: NamedStateIdentity): Promise<void> {
    await page.goto(this.baseUrl);
    await page.getByTestId('sign-in-tab')
      .or(page.locator('#tab-btn-signin'))
      .or(page.getByRole('button', { name: /sign in/i }))
      .first()
      .click();
    const signInForm = page.locator('#mode-signin-segment form');
    await signInForm.getByLabel(/email address/i).fill(identity.email);
    await signInForm.getByLabel(/^password$/i).fill(PUBLIC_NAMED_STATE_PASSWORD);
    const [response] = await Promise.all([
      page.waitForResponse(response => response.request().method() === 'POST'
        && new URL(response.url()).pathname === '/api/auth/login'),
      signInForm.getByRole('button', { name: 'Sign in', exact: true }).click()
    ]);
    expect(response.ok(), 'The secondary owner must sign in successfully.').toBe(true);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
}
