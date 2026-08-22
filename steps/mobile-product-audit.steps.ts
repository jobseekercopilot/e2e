import {Then} from '@cucumber/cucumber';
import {MobileProductAuditPage} from '../pages/MobileProductAuditPage';
import type {JobSeekerWorld} from '../support/world';

Then(
  'five governed personas complete phone journeys',
  {timeout: 15 * 60_000},
  async function (this: JobSeekerWorld) {
    if (!this.browser || !this.namedStateDefinition) {
      throw new Error('The mobile product audit requires a browser and REAL_WORLD_PERSONAS state.');
    }
    await new MobileProductAuditPage(this.browser, this.config.baseUrl)
      .auditPhones(this.namedStateDefinition.identities);
  },
);

Then(
  'a governed persona completes the tablet layout audit',
  {timeout: 5 * 60_000},
  async function (this: JobSeekerWorld) {
    if (!this.browser || !this.namedStateDefinition) {
      throw new Error('The tablet product audit requires a browser and REAL_WORLD_PERSONAS state.');
    }
    await new MobileProductAuditPage(this.browser, this.config.baseUrl)
      .auditTablet(this.namedStateDefinition.identities);
  },
);

Then(
  'a governed persona completes the desktop visual audit',
  {timeout: 5 * 60_000},
  async function (this: JobSeekerWorld) {
    if (!this.browser || !this.namedStateDefinition) {
      throw new Error('The desktop product audit requires a browser and REAL_WORLD_PERSONAS state.');
    }
    await new MobileProductAuditPage(this.browser, this.config.baseUrl)
      .auditDesktop(this.namedStateDefinition.identities);
  },
);
