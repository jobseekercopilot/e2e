import { Then, When } from '@cucumber/cucumber';
import type { JobSeekerWorld } from '../support/world';

When('the user creates {int} saved applications without documents', async function (
  this: JobSeekerWorld,
  count: number,
) {
  if (!this.applicationDocumentJourneyPage) {
    throw new Error('The application document journey page was not initialised.');
  }
  for (let index = 0; index < count; index += 1) {
    await this.applicationDocumentJourneyPage.startJourney('ADD');
    await this.applicationDocumentJourneyPage.chooseDocuments({
      CV: 'OMIT',
      COVER_LETTER: 'OMIT',
    });
  }
});

Then('reporting reconciles exactly {int} source applications through the API and UI', async function (
  this: JobSeekerWorld,
  count: number,
) {
  if (!this.reportingReconciliationPage) {
    throw new Error('The reporting reconciliation page was not initialised.');
  }
  await this.reportingReconciliationPage.reconcile(count);
});
