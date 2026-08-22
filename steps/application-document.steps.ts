import { Given, Then, When } from '@cucumber/cucumber';
import type { ApplicationDocumentJourneyPage, DocumentChoice, DocumentPurpose } from '../pages/ApplicationDocumentJourneyPage';
import type { JobSeekerWorld } from '../support/world';

function journey(world: JobSeekerWorld): ApplicationDocumentJourneyPage {
  if (!world.applicationDocumentJourneyPage) {
    throw new Error('Application document journey page was not initialised.');
  }
  return world.applicationDocumentJourneyPage;
}

function choice(value: string): DocumentChoice {
  if (value === 'Generate') return 'GENERATE';
  if (value === 'Upload') return 'UPLOAD';
  if (value === 'Not now') return 'OMIT';
  throw new Error(`Unsupported application document choice: ${value}`);
}

function selected(world: JobSeekerWorld, expected: DocumentChoice): DocumentPurpose[] {
  const choices = world.applicationDocumentChoices;
  if (!choices) throw new Error('Application document choices were not recorded.');
  return (['CV', 'COVER_LETTER'] as const).filter(purpose => choices[purpose] === expected);
}

Given('the first cross-user identity is signed in', async function (this: JobSeekerWorld) {
  const identity = this.namedStateDefinition?.identities[0];
  if (!identity || !this.stabilisationPage) {
    throw new Error('The CROSS_USER_SECURITY state did not provide its first identity.');
  }
  await this.stabilisationPage.signInDemoReady(identity);
});

Given('the primary named-state user is signed in', async function (this: JobSeekerWorld) {
  const identity = this.namedStateDefinition?.identities[0];
  if (!identity || !this.stabilisationPage) {
    throw new Error('The named state did not provide a primary identity.');
  }
  await this.stabilisationPage.signInDemoReady(identity);
});

When(/^(?:the user|the owner) starts the (Add|Generate) application document journey$/,
  async function (this: JobSeekerWorld, entryPoint: 'Add' | 'Generate') {
    await journey(this).startJourney(entryPoint === 'Add' ? 'ADD' : 'GENERATE');
  });

When(/^(?:the user|the owner) chooses (Generate|Upload|Not now) for the CV and (Generate|Upload|Not now) for the cover letter$/,
  async function (this: JobSeekerWorld, cv: string, cover: string) {
    this.applicationDocumentChoices = { CV: choice(cv), COVER_LETTER: choice(cover) };
    await journey(this).chooseDocuments(this.applicationDocumentChoices);
  });

When('the user uploads a valid DOCX CV and skips the cover letter', async function (this: JobSeekerWorld) {
  this.applicationDocumentChoices = { CV: 'UPLOAD', COVER_LETTER: 'OMIT' };
  await journey(this).chooseSafeDocxForCv();
});

When('the user uploads the {word} CV fixture and skips the cover letter', async function (
  this: JobSeekerWorld,
  fixtureName: string
) {
  this.applicationDocumentChoices = { CV: 'UPLOAD', COVER_LETTER: 'OMIT' };
  await journey(this).chooseNamedCvFixture(fixtureName);
});

Then('the browser rejects the {word} CV fixture before upload', async function (
  this: JobSeekerWorld,
  fixtureName: string
) {
  await journey(this).assertCvFixtureRejectedByBrowser(fixtureName);
});

Then('the CV upload is safely rejected without changing the application', async function (
  this: JobSeekerWorld
) {
  await journey(this).assertCvUploadSafelyRejected();
});

Then('the user can recover with a valid replacement CV', async function (this: JobSeekerWorld) {
  await journey(this).recoverRejectedCvWithSafeDocx();
});

Then('the selected application uploads complete', async function (this: JobSeekerWorld) {
  await journey(this).completeUploads(selected(this, 'UPLOAD'));
});

Then('the selected application generation completes', async function (this: JobSeekerWorld) {
  await journey(this).completeGeneration(selected(this, 'GENERATE'));
});

Then('the saved application contains the exact selected document references', async function (this: JobSeekerWorld) {
  if (!this.applicationDocumentChoices) throw new Error('Application document choices were not recorded.');
  await journey(this).assertApplication(this.applicationDocumentChoices);
});

Then('the application document generation allowance and content boundary is correct', async function (this: JobSeekerWorld) {
  const generated = selected(this, 'GENERATE');
  if (generated.length > 0) {
    await journey(this).assertSelectedGenerationSpentCredit(generated.length);
    if (selected(this, 'UPLOAD').length > 0) {
      await journey(this).assertUploadBoundary(selected(this, 'UPLOAD').length);
    }
  } else {
    await journey(this).assertUploadCreditAndBoundary(selected(this, 'UPLOAD').length);
  }
});

Then('the uploaded application document download is private and safe', async function (this: JobSeekerWorld) {
  const uploaded = selected(this, 'UPLOAD');
  if (uploaded.length === 0) throw new Error('The scenario selected no uploaded document.');
  await journey(this).assertUploadedDownloadHeaders(uploaded[0]);
});

Then('application document reporting remains content-free', async function (this: JobSeekerWorld) {
  await journey(this).assertReportingContentFree();
});

Then('the generated application survives refresh and explicit lifecycle progression', async function (
  this: JobSeekerWorld
) {
  if (!this.applicationTrackerPage) {
    throw new Error('Application Tracker page was not initialised.');
  }
  const expected = await journey(this).preparedApplicationExpectation();
  await this.applicationTrackerPage.provePreparedApplicationLifecycle(expected);
});

Then("the second cross-user identity is denied the first owner's upload and application",
  async function (this: JobSeekerWorld) {
    const identity = this.namedStateDefinition?.identities[1];
    if (!identity || !this.browser) {
      throw new Error('The CROSS_USER_SECURITY state did not provide its second identity.');
    }
    await journey(this).assertSecondOwnerDenied(this.browser, identity);
  });
