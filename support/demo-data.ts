import alexTaylor from '../fixtures/users/alex-taylor.json';
import softwareDeveloperSearch from '../fixtures/jobs/software-developer-search.json';
import type { DemoUser } from './world';
import type { JobSearchFixture } from '../pages/JobSearchPage';

export function alexTaylorDemoUser(options: { uniqueEmail?: boolean } = {}): DemoUser {
  const demoUser = alexTaylor as DemoUser;

  if (!options.uniqueEmail) {
    return demoUser;
  }

  const [localPart, domain] = demoUser.email.split('@');
  return {
    ...demoUser,
    email: `${localPart}+demo-${Date.now()}@${domain}`
  };
}

export function softwareDeveloperSearchFixture(): JobSearchFixture {
  return softwareDeveloperSearch as JobSearchFixture;
}
