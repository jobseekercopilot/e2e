import {Then, When} from '@cucumber/cucumber';
import {syntheticProfessionalContact} from '../support/beta-trust-fixtures';
import type {JobSeekerWorld} from '../support/world';

When('the owner saves synthetic professional contact details', async function (
  this: JobSeekerWorld
) {
  if (!this.profilePage) throw new Error('Claimant profile page was not initialised.');
  await this.profilePage.saveProfessionalContact(syntheticProfessionalContact());
});

Then('the approved CV download shows the exact professional contact in its header', async function (
  this: JobSeekerWorld
) {
  if (!this.applicationDocumentJourneyPage) {
    throw new Error('Application document journey page was not initialised.');
  }
  await this.applicationDocumentJourneyPage.assertApprovedCvContainsProfessionalContact(
    syntheticProfessionalContact()
  );
});

Then('the browser generation command contains no professional contact', async function (
  this: JobSeekerWorld
) {
  if (!this.applicationDocumentJourneyPage) {
    throw new Error('Application document journey page was not initialised.');
  }
  await this.applicationDocumentJourneyPage.assertProfessionalContactBoundary(
    syntheticProfessionalContact()
  );
});

When('the owner searches with the confirmed named-state profile', async function (
  this: JobSeekerWorld
) {
  if (!this.jobSearchPage) throw new Error('Job search page was not initialised.');
  await this.jobSearchPage.searchWithConfirmedProfileEvidence();
});

Then('the response and card show deterministic profile matching and provider provenance', async function (
  this: JobSeekerWorld
) {
  if (!this.jobSearchPage) throw new Error('Job search page was not initialised.');
  await this.jobSearchPage.assertDeterministicProfileMatchAndProviderProvenance();
});

Then('query-only and unavailable fixture projections remain truthfully labelled', async function (
  this: JobSeekerWorld
) {
  if (!this.jobSearchPage) throw new Error('Job search page was not initialised.');
  await this.jobSearchPage.assertQueryOnlyAndUnavailableFallbacks();
});

Then('real fixture generation completes under the bounded recovery-summary contract projection', async function (
  this: JobSeekerWorld
) {
  if (!this.applicationDocumentJourneyPage) {
    throw new Error('Application document journey page was not initialised.');
  }
  await this.applicationDocumentJourneyPage.completeGenerationWithTransparentRecovery([
    'CV',
    'COVER_LETTER',
  ]);
});
