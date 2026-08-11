import { expect, type Browser, type Page } from '@playwright/test';
import { ApplicationDocumentJourneyPage } from './ApplicationDocumentJourneyPage';
import { PUBLIC_NAMED_STATE_PASSWORD } from '../support/demo-data';
import type { NamedStateDefinition } from '../support/system-data';

type PersonaIdentity = NamedStateDefinition['identities'][number];

interface ProfileShape {
  bytes: number;
  qualifications: number;
  roles: number;
  skills: number;
}

function largestArrayForKey(value: unknown, target: string): number {
  if (Array.isArray(value)) {
    return value.reduce((largest, child) => Math.max(largest, largestArrayForKey(child, target)), 0);
  }
  if (typeof value !== 'object' || value === null) return 0;
  let largest = 0;
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === target && Array.isArray(child)) largest = Math.max(largest, child.length);
    largest = Math.max(largest, largestArrayForKey(child, target));
  }
  return largest;
}

export class PersonaBrowserReplayPage {
  constructor(private readonly browser: Browser, private readonly baseUrl: string) {}

  async replay(identities: PersonaIdentity[]): Promise<void> {
    expect(identities).toHaveLength(7);
    const expectedKeys = [
      'minimal-profile',
      'typical-profile',
      'rich-profile',
      'very-rich-profile',
      'uploaded-cv-first',
      'manual-profile-first',
      'career-changer',
    ];
    expect(identities.map(identity => identity.key)).toEqual(expectedKeys);

    for (const identity of identities) {
      const context = await this.browser.newContext({baseURL: this.baseUrl});
      try {
        const page = await context.newPage();
        await this.signIn(page, identity);
        const before = await this.profileShape(page, identity);
        await page.reload();
        await expect(page.getByTestId('workspace-tab-search')).toBeVisible();
        expect(await this.profileShape(page, identity)).toEqual(before);

        const journey = new ApplicationDocumentJourneyPage(page, this.baseUrl);
        if (identity.key === 'uploaded-cv-first') {
          await journey.startJourney('ADD');
          await journey.chooseSafeDocxForCv();
          await journey.completeUploads(['CV']);
          await journey.assertApplication({CV: 'UPLOAD', COVER_LETTER: 'OMIT'});
        }

        await journey.startJourney('GENERATE');
        await this.assertMeaningfulSearch(page);
        await journey.chooseDocuments({CV: 'GENERATE', COVER_LETTER: 'OMIT'});
        await journey.completeGeneration(['CV']);
        await journey.assertApplication({CV: 'GENERATE', COVER_LETTER: 'OMIT'});

        if (identity.key === 'manual-profile-first') {
          await journey.startJourney('ADD');
          await journey.chooseSafeDocxForCv();
          await journey.completeUploads(['CV']);
          await journey.assertApplication({CV: 'UPLOAD', COVER_LETTER: 'OMIT'});
        }

        const after = await this.profileShape(page, identity);
        expect(after.skills).toBe(before.skills);
        expect(after.roles).toBe(before.roles);
        expect(after.qualifications).toBe(before.qualifications);
        if (identity.key === 'very-rich-profile') {
          expect(after).toMatchObject({skills: 60, roles: 18, qualifications: 6});
        }
      } finally {
        await context.close();
      }
    }
  }

  private async signIn(page: Page, identity: PersonaIdentity): Promise<void> {
    await page.goto(this.baseUrl);
    await page.getByTestId('sign-in-tab')
      .or(page.locator('#tab-btn-signin'))
      .or(page.getByRole('button', {name: /sign in/i}))
      .first()
      .click();
    const form = page.locator('#mode-signin-segment form');
    await form.getByLabel(/email address/i).fill(identity.email);
    await form.getByLabel(/^password$/i).fill(PUBLIC_NAMED_STATE_PASSWORD);
    const response = page.waitForResponse(candidate =>
      candidate.request().method() === 'POST'
      && new URL(candidate.url()).pathname === '/api/auth/login');
    await form.getByRole('button', {name: 'Sign in', exact: true}).click();
    const login = await response;
    expect(login.ok(), `${identity.key} login returned HTTP ${login.status()}.`).toBe(true);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('#left-sidebar')).toContainText(identity.displayName);
  }

  private async profileShape(page: Page, identity: PersonaIdentity): Promise<ProfileShape> {
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/auth/profile');
      return {status: response.status, text: await response.text()};
    });
    expect(result.status).toBe(200);
    expect(result.text).toContain(identity.displayName);
    const profile = JSON.parse(result.text) as unknown;
    return {
      bytes: Buffer.byteLength(result.text),
      skills: largestArrayForKey(profile, 'skills'),
      roles: largestArrayForKey(profile, 'roles'),
      qualifications: largestArrayForKey(profile, 'qualifications'),
    };
  }

  private async assertMeaningfulSearch(page: Page): Promise<void> {
    const workspace = page.getByTestId('job-results-workspace');
    await expect(workspace.getByTestId('job-result-card').first()).toBeVisible();
    await expect(workspace.locator('.results-count')).toContainText(/match/i);
    const card = workspace.getByTestId('job-result-card').first();
    await expect(card.locator('.job-title')).not.toHaveText('');
    await expect(card.locator('.job-company')).not.toHaveText('');
    await expect(card.locator('.job-description')).not.toHaveText('');
  }
}
