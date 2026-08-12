import { Given, Then, When } from '@cucumber/cucumber';
import { showcaseCandidate } from '../support/showcase-data';
import type { JobSeekerWorld } from '../support/world';

Given('the showcase candidate is ready to register', function (this: JobSeekerWorld) {
  const identity = this.namedStateDefinition?.identities.find(candidate =>
    candidate.key === 'registration-primary');
  if (!identity) throw new Error('REGISTRATION_CLEAN did not provide registration-primary.');
  this.showcaseCandidate = showcaseCandidate(identity.email);
  this.demoUser = this.showcaseCandidate;
});

When('the showcase chapter {string} begins', function (this: JobSeekerWorld, chapter: string) {
  this.markShowcaseSection(chapter);
});

When(
  'Alex builds a rich professional profile and evidence library',
  { timeout: 8 * 60_000 },
  async function (this: JobSeekerWorld) {
    if (!this.showcaseCandidate || !this.productShowcasePage) throw new Error('Showcase candidate was not initialised.');
    await this.productShowcasePage.completeProfessionalProfile(this.showcaseCandidate);
  },
);

When('Alex discovers the selected showcase job', async function (this: JobSeekerWorld) {
  if (!this.showcaseCandidate || !this.productShowcasePage) throw new Error('Showcase candidate was not initialised.');
  await this.productShowcasePage.openSelectedJob(this.showcaseCandidate);
});

When(
  'Alex generates a CV and cover letter for the same showcase job',
  {timeout: 12 * 60_000},
  async function (this: JobSeekerWorld) {
    if (!this.showcaseCandidate || !this.applicationDocumentJourneyPage) throw new Error('Showcase journey was not initialised.');
    await this.productShowcasePage?.verifyLiveShowcaseRuntime();
    this.applicationDocumentChoices = { CV: 'GENERATE', COVER_LETTER: 'GENERATE' };
    await this.applicationDocumentJourneyPage.startJourney('GENERATE', this.showcaseCandidate.selectedJob);
    await this.applicationDocumentJourneyPage.chooseDocuments(this.applicationDocumentChoices);
    await this.applicationDocumentJourneyPage.completeGeneration(
      ['CV', 'COVER_LETTER'],
      {
        CV: [
          'Software Developer',
          'Software Engineering Intern',
          'BSc Computer Science',
          'AWS Certified Developer',
          'Application Delivery Platform',
        ],
        COVER_LETTER: [
          'Software Developer',
          'AWS Certified Developer',
          'Application Delivery Platform',
        ],
      },
    );
    await this.applicationDocumentJourneyPage.assertApplication(this.applicationDocumentChoices);
  },
);

Then('the tailored application documents are ready', async function (this: JobSeekerWorld) {
  if (!this.showcaseCandidate || !this.productShowcasePage) throw new Error('Showcase candidate was not initialised.');
  await this.productShowcasePage.showGenerationOutcome(this.showcaseCandidate);
});

When('Alex reviews and previews both generated documents', async function (this: JobSeekerWorld) {
  if (!this.showcaseCandidate || !this.documentsPage) throw new Error('Showcase candidate was not initialised.');
  const saved = await this.documentsPage.showShowcaseDocuments(
    this.showcaseCandidate.selectedJob.title,
    this.showcaseCandidate.selectedJob.company
  );
  if (saved.length !== 2) throw new Error(`Expected two showcase downloads, received ${saved.length}.`);
  this.demoDownloads.push(...saved.map(download => download.path));
});

When('Alex progresses the same application to interview', async function (this: JobSeekerWorld) {
  if (!this.showcaseCandidate || !this.applicationTrackerPage) throw new Error('Showcase candidate was not initialised.');
  await this.applicationTrackerPage.showShowcaseApplication(
    this.showcaseCandidate.selectedJob.title,
    this.showcaseCandidate.selectedJob.company
  );
});

Then('Alex sees meaningful job-search reporting', async function (this: JobSeekerWorld) {
  if (!this.productShowcasePage) throw new Error('Showcase page was not initialised.');
  await this.productShowcasePage.showMeaningfulReporting();
});

Then('Alex returns to the same selected job', async function (this: JobSeekerWorld) {
  if (!this.showcaseCandidate || !this.productShowcasePage) throw new Error('Showcase candidate was not initialised.');
  await this.productShowcasePage.openSelectedJob(this.showcaseCandidate, true);
  await this.productShowcasePage.expectSelectedJobStatus(this.showcaseCandidate, 'Interview');
  await this.page?.waitForTimeout(this.config.demoBufferMs);
});

When('Alex signs out and signs back in', async function (this: JobSeekerWorld) {
  if (!this.showcaseCandidate || !this.navigationPage || !this.registerPage) {
    throw new Error('Showcase returning-user journey was not initialised.');
  }
  await this.navigationPage.signOutAndRejectProtectedReuse();
  await this.registerPage.loginUser(this.showcaseCandidate);
});

Then(
  "Alex's profile, documents, application and reporting state persist",
  async function (this: JobSeekerWorld) {
    if (!this.showcaseCandidate || !this.productShowcasePage || !this.documentsPage
      || !this.applicationTrackerPage || !this.reportingReconciliationPage) {
      throw new Error('Showcase returning-user assertions were not initialised.');
    }
    const {title, company} = this.showcaseCandidate.selectedJob;
    await this.productShowcasePage.expectProfessionalProfilePersisted(this.showcaseCandidate);
    await this.documentsPage.expectShowcaseDocumentsPersisted(title, company);
    await this.applicationTrackerPage.expectShowcaseApplicationPersisted(title, company, 'interview');
    await this.reportingReconciliationPage.reconcile(1);
  },
);
