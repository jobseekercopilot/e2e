import { Given, Then, When } from '@cucumber/cucumber';
import type { StabilisationPage } from '../pages/StabilisationPage';
import type { JobSeekerWorld } from '../support/world';

function checkpoint(world: JobSeekerWorld): StabilisationPage {
  if (!world.stabilisationPage) {
    throw new Error('The stabilisation page was not initialised.');
  }
  return world.stabilisationPage;
}

function demoReadyIdentity(world: JobSeekerWorld) {
  if (world.namedState !== 'DEMO_READY') {
    throw new Error('The live stabilisation checkpoint is restricted to DEMO_READY.');
  }
  const identity = world.namedStateDefinition?.identities.find(
    candidate => candidate.key === 'alex-taylor'
  );
  if (!identity) {
    throw new Error('DEMO_READY does not define its isolated alex-taylor identity.');
  }
  return identity;
}

Given(
  'the isolated DEMO_READY job seeker is signed in',
  async function (this: JobSeekerWorld) {
    await checkpoint(this).signInDemoReady(demoReadyIdentity(this));
  }
);

Then('the profile uses professional section labels', async function (this: JobSeekerWorld) {
  await checkpoint(this).expectProfessionalProfileLabels();
});

Then(
  'Experience and achievements is a compact profile summary',
  async function (this: JobSeekerWorld) {
    await checkpoint(this).expectCompactEvidenceSummary();
  }
);

When(
  'the advanced Experience and achievements manager is opened',
  async function (this: JobSeekerWorld) {
    await checkpoint(this).openEvidenceManager();
  }
);

When('a minimal Project is created and confirmed', async function (this: JobSeekerWorld) {
  await checkpoint(this).createAndConfirmProject();
});

When('a minimal Employment is created and confirmed', async function (this: JobSeekerWorld) {
  await checkpoint(this).createAndConfirmEmployment();
});

When('a minimal Qualification is created and confirmed', async function (this: JobSeekerWorld) {
  await checkpoint(this).createAndConfirmQualification();
});

Then(
  'the confirmed evidence is reflected in the compact profile summary',
  async function (this: JobSeekerWorld) {
    await checkpoint(this).closeEvidenceManagerAndVerifySummary();
  }
);

Given(
  'focused Project and Qualification evidence is confirmed',
  async function (this: JobSeekerWorld) {
    await checkpoint(this).prepareConfirmedGenerationEvidence();
  }
);

Given(
  'the profile is configured for two broad target roles',
  async function (this: JobSeekerWorld) {
    await checkpoint(this).configureSearchProfile();
  }
);

Then(
  'both target roles have independent real-provider results and page state',
  { timeout: 300_000 },
  async function (this: JobSeekerWorld) {
    await checkpoint(this).verifyIndependentRoleSearchAndPaging();
  }
);

Then(
  'a provider job description expands and collapses safely',
  async function (this: JobSeekerWorld) {
    await checkpoint(this).verifyExpandableJobDescription();
  }
);

When(
  'an unsaved job is saved and its evidence selector is previewed',
  async function (this: JobSeekerWorld) {
    await checkpoint(this).saveJobAndPreviewEvidenceSelection();
  }
);

Then(
  'document preparation remains attached to that selected job',
  async function (this: JobSeekerWorld) {
    await checkpoint(this).expectDocumentPreparationAttached();
  }
);

Given(
  'the runtime exposes real providers and real OpenAI generation',
  async function (this: JobSeekerWorld) {
    await checkpoint(this).assertRealGenerationRuntime(this.config.allowAiGeneration);
  }
);

When(
  'five distinct application and document journeys run consecutively',
  { timeout: 4_500_000 },
  async function (this: JobSeekerWorld) {
    await checkpoint(this).runFiveConsecutiveJourneys();
  }
);

Then('all five isolated live journeys have completed', function (this: JobSeekerWorld) {
  checkpoint(this).expectFiveJourneysCompleted();
});

When(
  'one separately authorised generation probe completes',
  { timeout: 1_200_000 },
  async function (this: JobSeekerWorld) {
    await checkpoint(this).runSingleGenerationProbe(
      this.config.allowAiGeneration,
      this.config.allowSingleGenerationProbe
    );
  }
);

Then(
  'exactly one probe operation and completed job are recorded',
  function (this: JobSeekerWorld) {
    checkpoint(this).expectSingleGenerationProbeCompleted();
  }
);

When(
  'two browser sessions submit different profile revisions',
  { timeout: 300_000 },
  async function (this: JobSeekerWorld) {
    if (!this.browser) throw new Error('The browser was not initialised.');
    await checkpoint(this).verifyStaleRevisionAcrossTwoSessions(
      this.browser,
      demoReadyIdentity(this)
    );
  }
);

Then('the stale session receives the actionable conflict state', function (this: JobSeekerWorld) {
  checkpoint(this).expectStaleRevisionConflict();
});

When(
  'one explicitly authorised live generation is cancelled',
  { timeout: 900_000 },
  async function (this: JobSeekerWorld) {
    await checkpoint(this).cancelOneGenerationAndVerifySelectionRecovery(
      this.config.allowAiGeneration,
      this.config.allowCancellationE2e
    );
  }
);

Then('its evidence selection is available for a safe retry', function (this: JobSeekerWorld) {
  checkpoint(this).expectCancellationSelectionRecovery();
});
