import { Then, When } from '@cucumber/cucumber';
import type { ApplicationTrackerPage } from '../pages/ApplicationTrackerPage';
import type { JobSeekerWorld } from '../support/world';

function tracker(world: JobSeekerWorld): ApplicationTrackerPage {
  if (!world.applicationTrackerPage) {
    throw new Error('Application Tracker page was not initialised.');
  }
  return world.applicationTrackerPage;
}

When('he opens the application tracker', async function (this: JobSeekerWorld) {
  await tracker(this).open();
});

When('he focuses a software developer application', async function (this: JobSeekerWorld) {
  await tracker(this).waitForApplications();
});

Then('he can change the application status if available', async function (this: JobSeekerWorld) {
  await tracker(this).moveApplicationToInterview();
});

Then('only the relevant specialist application should be visible', async function (this: JobSeekerWorld) {
  await tracker(this).expectRelevantSpecialistApplication();
});

When('he marks an application as offer if available', async function (this: JobSeekerWorld) {
  await tracker(this).open();
  await tracker(this).moveInterviewApplicationToOffer();
});

When('he moves an application to interview', async function (this: JobSeekerWorld) {
  await tracker(this).moveApplicationToInterview();
});

Then('the tracker shows the application at interview', async function (this: JobSeekerWorld) {
  await tracker(this).focusApplicationWithStatus(/Interview/i);
  await tracker(this).expectLastChangedStatusAfterRefresh('interview');
});

When('he moves an interview application to offer', async function (this: JobSeekerWorld) {
  await tracker(this).moveInterviewApplicationToOffer();
});

Then('the tracker shows the application as offer secured', async function (this: JobSeekerWorld) {
  await tracker(this).focusApplicationWithStatus(/Offer/i);
  await tracker(this).expectLastChangedStatusAfterRefresh('offer');
});
