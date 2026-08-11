import { Then } from '@cucumber/cucumber';
import type { JobSeekerWorld } from '../support/world';
import { PersonaBrowserReplayPage } from '../pages/PersonaBrowserReplayPage';

Then(
  'all seven governed personas complete their supported browser journeys',
  {timeout: 12 * 60_000},
  async function (this: JobSeekerWorld) {
    if (!this.browser || !this.namedStateDefinition) {
      throw new Error('The persona browser replay requires a browser and PERSONA_BOUNDARIES state.');
    }
    await new PersonaBrowserReplayPage(this.browser, this.config.baseUrl)
      .replay(this.namedStateDefinition.identities);
  },
);
