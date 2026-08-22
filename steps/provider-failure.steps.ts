import { Then, When } from '@cucumber/cucumber';
import { expect, type APIResponse } from '@playwright/test';
import type { JobSeekerWorld } from '../support/world';

let providerFailureResponse: APIResponse | undefined;

When('the deterministic provider-failure boundary is requested', async function (this: JobSeekerWorld) {
  if (!this.context || !this.config.systemDataUrl) {
    throw new Error('Provider-failure E2E requires the bounded system-data fixture service.');
  }
  providerFailureResponse = await this.context.request.get(new URL(
    '/internal/fixtures/jobs/search?scenario=PROVIDER_FAILURE',
    this.config.systemDataUrl
  ).toString());
});

Then('the provider failure is reported without returning fixture jobs', async function () {
  if (!providerFailureResponse) throw new Error('Provider-failure response was not captured.');
  expect(providerFailureResponse.status()).toBe(502);
  expect(await providerFailureResponse.json()).toEqual({
    error: 'Synthetic provider fixture is unavailable'
  });
});
