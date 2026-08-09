import { expect, type Browser, type BrowserContext, type Locator, type Page, type Response } from '@playwright/test';
import type { NamedStateIdentity } from './StabilisationPage';
import { PUBLIC_NAMED_STATE_PASSWORD } from '../support/demo-data';
import { applicationDocumentFixtures, type ApplicationDocumentFixture } from '../support/application-document-fixtures';

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

interface UploadOperation {
  operationId?: string;
  applicationId?: string;
  documentId?: string;
  documentType?: string;
  state?: string;
  [key: string]: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  private readonly pendingResponseReads: Promise<void>[] = [];
  private generationStarts = 0;

  constructor(private readonly page: Page, private readonly baseUrl: string) {
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      if (!pathname.includes('/api/v1/document-generation/application-document-upload')) return;
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

  async startJourney(entryPoint: 'ADD' | 'GENERATE'): Promise<void> {
    this.walletBefore = await this.walletBalance();
    await this.page.goto('/dashboard');
    await this.page.getByTestId('workspace-tab-search').click();
    await this.ensureSearchResults();
    await expect(this.page.getByTestId('job-result-card').first()).toBeVisible({ timeout: 30_000 });
    this.selectedCard = await this.openJobCard(entryPoint);
    const action = this.selectedCard.getByTestId(
      entryPoint === 'ADD' ? 'track-application-button' : 'generate-documents-button'
    );
    const createsApplication = await this.selectedCard.getByTestId('track-application-button')
      .isVisible().catch(() => false);
    const createResponse = createsApplication
      ? this.page.waitForResponse(response =>
        response.request().method() === 'POST'
        && new URL(response.url()).pathname === '/api/jobs/applications')
      : undefined;
    if (!createsApplication) this.applicationId = await this.applicationIdForCard(this.selectedCard);
    await expect(action).toBeEnabled();
    await action.click();
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

  private async ensureSearchResults(): Promise<void> {
    const cards = this.page.getByTestId('job-result-card');
    if (await cards.first().isVisible().catch(() => false)) return;

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
      await this.page.getByRole('button', { name: 'Save this section', exact: true }).click();
      await expect(this.page.getByRole('button', { name: 'Save this section', exact: true })).toBeHidden();

      await this.page.getByRole('button', { name: 'Edit Working preferences', exact: true }).click();
      const workplace = this.page.getByRole('group', { name: 'Workplace', exact: true });
      await workplace.getByLabel('Remote', { exact: true }).check();
      await this.page.getByRole('button', { name: 'Save this section', exact: true }).click();
      await expect(this.page.getByRole('button', { name: 'Save this section', exact: true })).toBeHidden();
    }

    await expect(findJobs).toBeEnabled();
    await expect(this.page.getByTestId('job-results-workspace')).toBeVisible();
    await findJobs.click();
  }

  async chooseDocuments(choices: Record<DocumentPurpose, DocumentChoice>): Promise<void> {
    const fixtures = applicationDocumentFixtures();
    await this.choose('CV', choices.CV, fixtures.cvPdf);
    await this.choose('COVER_LETTER', choices.COVER_LETTER, fixtures.coverPdf);
    await this.page.getByTestId('application-document-choice')
      .getByRole('button', { name: 'Continue', exact: true })
      .click();
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

  async completeGeneration(expectedPurposes: DocumentPurpose[]): Promise<void> {
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
    if (await confirmation.isVisible().catch(() => false)) await confirmation.check();
    const selectAll = selector.getByRole('button', { name: 'Select all', exact: true });
    const count = await selectAll.count();
    expect(count).toBe(expectedPurposes.length);
    for (let index = 0; index < count; index += 1) await selectAll.nth(index).click();

    const startsBefore = this.generationStarts;
    const action = selector.getByRole('button', { name: /^Generate .*AI Credit/ });
    await expect(action).toBeEnabled();
    await action.click();
    const expectedLabel = expectedPurposes.length === 2
      ? /CV and cover letter generated successfully/i
      : new RegExp(`${expectedPurposes[0] === 'CV' ? 'CV' : 'Cover letter'} generated successfully`, 'i');
    await expect(this.selectedJobCard().getByText(expectedLabel).first()).toBeVisible({ timeout: 12 * 60_000 });
    expect(this.generationStarts).toBe(startsBefore + 1);
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
        const expectedFixture = purpose === 'CV'
          ? applicationDocumentFixtures().cvPdf
          : applicationDocumentFixtures().coverPdf;
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
    const result = await this.page.evaluate(async documentId => {
      const metadataResponse = await fetch(`/api/v1/document-generation/documents/${documentId}/files/latest`);
      const metadata = await metadataResponse.json() as {pdf?: {downloadUrl?: string}};
      const downloadResponse = await fetch(metadata.pdf?.downloadUrl ?? '');
      return {
        metadataStatus: metadataResponse.status,
        downloadStatus: downloadResponse.status,
        cacheControl: downloadResponse.headers.get('cache-control'),
        contentType: downloadResponse.headers.get('content-type'),
        contentDisposition: downloadResponse.headers.get('content-disposition'),
        nosniff: downloadResponse.headers.get('x-content-type-options')
      };
    }, operation.documentId);
    expect(result.metadataStatus).toBe(200);
    expect(result.downloadStatus).toBe(200);
    expect(result.cacheControl).toContain('private');
    expect(result.cacheControl).toContain('no-store');
    expect(result.contentType).toContain('application/pdf');
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

  private async openJobCard(entryPoint: 'ADD' | 'GENERATE'): Promise<Locator> {
    const cards = this.page.getByTestId('job-result-card');
    const count = await cards.count();
    for (let index = 0; index < count; index += 1) {
      const card = cards.nth(index);
      if (!(await card.isVisible().catch(() => false))) continue;
      const toggle = card.getByRole('button', { name: 'Toggle job details', exact: true });
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
      const action = card.getByTestId(
        entryPoint === 'ADD' ? 'track-application-button' : 'generate-documents-button'
      );
      if (await action.isVisible().catch(() => false)) return card;
      if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click();
    }
    throw new Error(`The fixture job search returned no ${entryPoint.toLowerCase()} application candidate.`);
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
      await fieldset.locator('input[type="file"]').setInputFiles({
        name: upload.name,
        mimeType: upload.mimeType,
        buffer: upload.bytes
      });
    }
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
    await page.goto('/');
    await page.getByTestId('sign-in-tab').click();
    await page.getByLabel(/email address/i).fill(identity.email);
    await page.getByLabel(/^password$/i).fill(PUBLIC_NAMED_STATE_PASSWORD);
    await Promise.all([
      page.waitForResponse(response => response.request().method() === 'POST'
        && new URL(response.url()).pathname === '/api/auth/login'),
      page.locator('#mode-signin-segment form').getByRole('button', { name: 'Sign in', exact: true }).click()
    ]);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
}
