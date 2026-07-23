import { Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { JobSeekerWorld } from '../support/world';

Then('the smoke execution profile is fail-closed', function (this: JobSeekerWorld) {
  assert.equal(this.config.profile, 'smoke');
  assert.equal(this.config.demoMode, false);
  assert.equal(this.config.useSavedSession, false);
  assert.equal(this.config.saveDemoSession, false);
  assert.equal(this.browser, undefined);
  assert.equal(this.context, undefined);
});

Then('the accessibility execution profile is fail-closed', function (this: JobSeekerWorld) {
  assert.equal(this.config.profile, 'accessibility');
  assert.equal(this.config.demoMode, false);
  assert.equal(this.config.useSavedSession, false);
  assert.equal(this.config.saveDemoSession, false);
  assert.equal(this.browser, undefined);
  assert.equal(this.context, undefined);
});
