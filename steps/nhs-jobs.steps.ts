import { Given, Then, When } from '@cucumber/cucumber';
import { expect, type Locator } from '@playwright/test';
import type { JobSeekerWorld } from '../support/world';

const EXTERNAL_JOB_ID = 'C9855-FIXTURE-001';
const LISTING_URL =
  `https://fixtures.jobseekercopilot.test/nhs-jobs/jobadvert/${EXTERNAL_JOB_ID}`;
const ATTRIBUTION_SOURCE_URL = 'https://www.jobs.nhs.uk/';
const LICENCE_URL =
  'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
const ATTRIBUTION = 'Vacancy source: NHS Jobs';
const DISCLAIMER = 'NHS Jobs does not endorse Job Seeker Copilot.';

type StoredNhsApplication = {
  id?: string;
  jobId?: string;
  canonicalJobId?: string;
  provider?: string;
  externalJobId?: string;
  listingUrl?: string;
  applyUrl?: string;
  attributionLabel?: string;
  attributionSourceUrl?: string;
  licenceUrl?: string;
  disclaimer?: string;
  jobTitle?: string;
};

function requirePage(world: JobSeekerWorld) {
  if (!world.page) throw new Error('The browser page was not initialised.');
  return world.page;
}

function assertSuccessful(
  response: { ok(): boolean; status(): number },
  operation: string,
): void {
  expect(
    response.ok(),
    `${operation} failed with HTTP ${response.status()}`,
  ).toBe(true);
}

function assertSource(application: StoredNhsApplication): void {
  expect(application.provider).toBe('NHS_JOBS');
  expect(application.externalJobId).toBe(EXTERNAL_JOB_ID);
  expect(application.jobId).toBeTruthy();
  expect(application.canonicalJobId).toBe(application.jobId);
  expect(application.listingUrl).toBe(LISTING_URL);
  expect(application.applyUrl).toBe(LISTING_URL);
  expect(application.attributionLabel).toBe(ATTRIBUTION);
  expect(application.attributionSourceUrl).toBe(ATTRIBUTION_SOURCE_URL);
  expect(application.licenceUrl).toBe(LICENCE_URL);
  expect(application.disclaimer).toBe(DISCLAIMER);
}

async function nhsResultCard(world: JobSeekerWorld): Promise<Locator> {
  const page = requirePage(world);
  const card = page
    .getByTestId('job-result-card')
    .filter({ hasText: 'Community Staff Nurse' })
    .first();
  await expect(
    card,
    'The required NHS fixture vacancy was not returned by the full search journey.',
  ).toBeVisible({ timeout: 30_000 });
  return card;
}

async function readDownload(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

Given(
  'the job seeker targets NHS community nursing roles',
  function (this: JobSeekerWorld) {
    if (!this.demoUser) {
      throw new Error('The named-state user must be loaded before setting NHS roles.');
    }
    this.demoUser = {
      ...this.demoUser,
      skills: ['Patient care', 'Community nursing'],
      targetRoles: ['Community Staff Nurse'],
    };
  },
);

Then(
  'the strict NHS fixture result is visible with attribution and safe links',
  async function (this: JobSeekerWorld) {
    const card = await nhsResultCard(this);
    const toggle = card.getByRole('button', { name: /toggle job details/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(card.getByText('NHS Jobs', { exact: true }).first()).toBeVisible();
    await expect(card.getByText(ATTRIBUTION, { exact: true })).toBeVisible();
    await expect(card.getByText(DISCLAIMER, { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: /official job source/i }))
      .toHaveAttribute('href', ATTRIBUTION_SOURCE_URL);
    await expect(card.getByRole('link', { name: /source licence/i }))
      .toHaveAttribute('href', LICENCE_URL);
    await expect(card.getByRole('link', { name: /view on NHS Jobs/i }))
      .toHaveAttribute('href', LISTING_URL);

    const unsafeLinks = card.locator(
      'a[href^="javascript:"], a[href^="data:"], a[href^="http:"]',
    );
    await expect(unsafeLinks).toHaveCount(0);
  },
);

When(
  'he adds the NHS vacancy to My Applications',
  async function (this: JobSeekerWorld) {
    const page = requirePage(this);
    const card = await nhsResultCard(this);
    const responsePromise = page.waitForResponse(response =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/jobs/applications',
    );

    const button = card.getByTestId('track-application-button');
    await expect(button).toBeEnabled();
    await button.click();
    const response = await responsePromise;
    assertSuccessful(response, 'Creating the NHS tracked application');
    this.nhsApplication = await response.json() as StoredNhsApplication;
  },
);

Then(
  'the saved NHS source metadata is returned by Application Tracking',
  function (this: JobSeekerWorld) {
    if (!this.nhsApplication) {
      throw new Error('Application Tracking did not return the created NHS application.');
    }
    assertSource(this.nhsApplication);
    expect(this.nhsApplication.id).toBeTruthy();
  },
);

When(
  'he reloads and opens the NHS application',
  async function (this: JobSeekerWorld) {
    const page = requirePage(this);
    await page.reload();
    await this.applicationTrackerPage?.open();

    const response = await page.request.get('/api/jobs/applications');
    assertSuccessful(response, 'Reloading Application Tracking');
    const applications = await response.json() as StoredNhsApplication[];
    const persisted = applications.find(application =>
      application.externalJobId === EXTERNAL_JOB_ID);
    if (!persisted) {
      throw new Error('The reloaded application list omitted the saved NHS vacancy.');
    }
    assertSource(persisted);
    expect(persisted.id).toBe(this.nhsApplication?.id);
    this.nhsApplication = persisted;

    const card = page
      .getByTestId('application-card')
      .filter({ hasText: 'Community Staff Nurse' })
      .first();
    await expect(card).toBeVisible();
    await card.locator('summary').filter({ hasText: /View Application/i }).click();
    this.nhsApplicationCard = card;
  },
);

Then(
  'the authoritative NHS source is still visible and unchanged',
  async function (this: JobSeekerWorld) {
    const card = this.nhsApplicationCard;
    if (!card) throw new Error('The persisted NHS application card was not opened.');

    await expect(card.getByText(ATTRIBUTION, { exact: true })).toBeVisible();
    await expect(card.getByText(DISCLAIMER, { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: /official NHS Jobs listing/i }))
      .toHaveAttribute('href', LISTING_URL);
    await expect(card.getByRole('link', { name: /attribution source/i }))
      .toHaveAttribute('href', ATTRIBUTION_SOURCE_URL);
    await expect(card.getByRole('link', { name: /Open Government Licence/i }))
      .toHaveAttribute('href', LICENCE_URL);
  },
);

When(
  'he opens Reporting evidence',
  async function (this: JobSeekerWorld) {
    const page = requirePage(this);
    await this.navigationPage?.goToDashboard();
    const panel = page.getByRole('heading', { name: 'Your job search progress' })
      .locator('..')
      .locator('..');
    await expect(panel).toBeVisible();
    const responsePromise = page.waitForResponse(response =>
      response.request().method() === 'GET'
      && new URL(response.url()).pathname === '/api/v1/reports/summary',
    );
    await panel.getByRole('button', { name: /^Refresh$/ }).click();
    const response = await responsePromise;
    assertSuccessful(response, 'Refreshing Reporting evidence');
    this.nhsReportingPanel = panel;
  },
);

Then(
  'NHS source evidence is present in the activity and UC journal',
  async function (this: JobSeekerWorld) {
    const panel = this.nhsReportingPanel;
    if (!panel) throw new Error('The Reporting panel was not opened.');
    await expect(panel.getByText(/provider=NHS_JOBS/).first()).toBeVisible();
    await expect(panel.getByText(new RegExp(`externalVacancyReference=${EXTERNAL_JOB_ID}`)).first())
      .toBeVisible();
    await expect(panel.getByText(new RegExp(`listingUrl=${LISTING_URL}`)).first())
      .toBeVisible();
    await expect(panel.getByText(new RegExp(`attribution=${ATTRIBUTION}`)).first())
      .toBeVisible();
    await expect(panel.getByText(new RegExp(`noEndorsement=${DISCLAIMER}`)).first())
      .toBeVisible();
  },
);

Then(
  'the downloaded evidence preserves the NHS vacancy source',
  async function (this: JobSeekerWorld) {
    const page = requirePage(this);
    const panel = this.nhsReportingPanel;
    if (!panel) throw new Error('The Reporting panel was not opened.');
    const downloadPromise = page.waitForEvent('download');
    await panel.getByRole('link', { name: /download evidence/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('job-search-evidence.txt');
    const stream = await download.createReadStream();
    if (!stream) throw new Error('The Reporting evidence download had no readable body.');
    const evidence = await readDownload(stream);

    expect(evidence).toContain('Job Seeker Copilot work-search evidence');
    expect(evidence).toContain('provider=NHS_JOBS');
    expect(evidence).toContain(`externalVacancyReference=${EXTERNAL_JOB_ID}`);
    expect(evidence).toContain(`canonicalJobId=${this.nhsApplication?.canonicalJobId}`);
    expect(evidence).toContain(`listingUrl=${LISTING_URL}`);
    expect(evidence).toContain(`applicationUrl=${LISTING_URL}`);
    expect(evidence).toContain(`attribution=${ATTRIBUTION}`);
    expect(evidence).toContain(`attributionSourceUrl=${ATTRIBUTION_SOURCE_URL}`);
    expect(evidence).toContain(`licenceUrl=${LICENCE_URL}`);
    expect(evidence).toContain(`noEndorsement=${DISCLAIMER}`);
    expect(evidence).toContain('not an official Universal Credit submission');
  },
);
