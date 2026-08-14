import { expect, type Browser, type Page } from '@playwright/test';
import { ApplicationDocumentJourneyPage } from './ApplicationDocumentJourneyPage';
import { PUBLIC_NAMED_STATE_PASSWORD } from '../support/demo-data';
import type { NamedStateDefinition } from '../support/system-data';

type PersonaIdentity = NamedStateDefinition['identities'][number];

const PERSONAS_WITHOUT_ALIGNED_FIXTURES = new Set([
  'minimal-profile',
  'uploaded-cv-first',
  'manual-profile-first',
  'career-changer',
]);

interface ProfileShape {
  bytes: number;
  evidenceSnapshot: string;
  qualifications: number;
  roles: number;
  skills: number;
}

const EMPTY_FIXTURE_TARGET_ROLES: Record<string, string[]> = {
  'minimal-profile': ['Administrative Assistant'],
  'uploaded-cv-first': ['Accounts Assistant', 'Payroll Administrator'],
  'manual-profile-first': ['Project Coordinator', 'Junior Project Manager'],
  'career-changer': ['Project Coordinator', 'Programme Support Officer'],
};

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
        this.assertPersonaEvidence(identity, before.evidenceSnapshot);
        await page.reload();
        await expect(page.getByTestId('workspace-tab-search')).toBeVisible();
        expect(await this.profileShape(page, identity)).toEqual(before);

        const journey = new ApplicationDocumentJourneyPage(page, this.baseUrl);
        if (PERSONAS_WITHOUT_ALIGNED_FIXTURES.has(identity.key)) {
          await this.assertNoAlignedFixtureResults(page, identity.key);
        } else {
          await journey.startJourney('GENERATE');
          await this.assertMeaningfulSearch(page);
          await journey.chooseDocuments({CV: 'GENERATE', COVER_LETTER: 'OMIT'});
          await journey.completeGeneration(['CV']);
          await journey.assertApplication({CV: 'GENERATE', COVER_LETTER: 'OMIT'});
        }

        const after = await this.profileShape(page, identity);
        expect(after.skills).toBe(before.skills);
        expect(after.roles).toBe(before.roles);
        expect(after.qualifications).toBe(before.qualifications);
        expect(after.evidenceSnapshot).toBe(before.evidenceSnapshot);
        if (identity.key === 'very-rich-profile') {
          expect(after).toMatchObject({skills: 60, roles: 18, qualifications: 6});
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown browser replay failure.';
        throw new Error(`Governed persona ${identity.key} failed: ${message}`, {cause: error});
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
      evidenceSnapshot: profileEvidenceSnapshot(profile),
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

  private assertPersonaEvidence(identity: PersonaIdentity, snapshot: string): void {
    if (identity.key === 'manual-profile-first') {
      expect(snapshot).toContain('Project Support Officer');
      expect(snapshot).toContain('Operations Administrator');
    }
    if (identity.key === 'uploaded-cv-first') {
      expect(snapshot).toContain('Finance Administrator');
      expect(snapshot).toContain('Customer Service Adviser');
      expect(snapshot).not.toContain('"jobTitle":"Accounts Assistant"');
      expect(snapshot).not.toContain('"jobTitle":"Payroll Administrator"');
    }
    if (identity.key === 'career-changer') {
      expect(snapshot).toContain('Secondary School Teacher');
      expect(snapshot).toContain('Museum Learning Assistant');
      expect(snapshot).not.toContain('"jobTitle":"Project Coordinator"');
      expect(snapshot).not.toContain('"jobTitle":"Programme Support Officer"');
    }
  }

  private async assertNoAlignedFixtureResults(page: Page, identityKey: string): Promise<void> {
    const expectedRoles = EMPTY_FIXTURE_TARGET_ROLES[identityKey];
    if (!expectedRoles) throw new Error(`No empty-fixture contract for ${identityKey}.`);
    await page.getByTestId('workspace-tab-search').click();
    const workspace = page.getByTestId('job-results-workspace');
    const findJobs = page.getByRole('button', {name: 'Find jobs', exact: true});
    await expect(findJobs).toBeEnabled();

    for (const [index, role] of expectedRoles.entries()) {
      const tab = workspace.getByRole('button', {
        name: new RegExp(`^${escapeRegExp(role)} \\((?:Not searched|0)\\)$`),
      });
      await expect(tab).toBeVisible();
      const searchResponse = page.waitForResponse(response =>
        response.request().method() === 'POST'
        && new URL(response.url()).pathname === '/api/jobs/search');
      if (index === 0) {
        await findJobs.click();
      } else {
        await tab.click();
      }
      const completedSearch = await searchResponse;
      expect(completedSearch.ok(), `The ${role} fixture search must complete successfully.`).toBe(true);
      const responseBody: unknown = await completedSearch.json();
      if (!isRecord(responseBody)) throw new Error(`The ${role} fixture search returned a non-object response.`);
      const responseGroups = array(responseBody['resultsByTargetRole']).filter(isRecord);
      expect(responseGroups.map(group => ({
        jobs: array(group['jobs']).length,
        targetRole: group['targetRole'],
        totalResults: group['totalResults'],
      }))).toEqual([{
        jobs: 0,
        targetRole: role,
        totalResults: 0,
      }]);

      await expect(workspace.getByRole('button', {name: 'Refresh', exact: true}))
        .toBeEnabled({timeout: 30_000});
      await expect(workspace.getByRole('button', {name: `${role} (0)`, exact: true}))
        .toHaveAttribute('aria-current', 'true');
      await expect(workspace.getByTestId('job-search-provider-mode'))
        .toHaveText('Fixture-backed provider data');
      await expect(workspace.getByTestId('job-result-card')).toHaveCount(0);
      await expect(workspace).toContainText('No jobs match your current profile.');
      await expect(workspace.getByTestId('job-search-trust-summary').locator('.search-filter-summary'))
        .toHaveText('2 unrelated occupations filtered before ranking.');
      await expect(workspace.getByTestId('generate-documents-button')).toHaveCount(0);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function profileEvidenceSnapshot(profile: unknown): string {
  const evidence: Record<string, string[]> = {};
  for (const key of ['skills', 'roles', 'qualifications']) {
    const values: unknown[][] = [];
    collectArraysForKey(profile, key, values);
    evidence[key] = values.map(value => JSON.stringify(canonicalValue(value))).sort();
  }
  return JSON.stringify(evidence);
}

function collectArraysForKey(value: unknown, target: string, result: unknown[][]): void {
  if (Array.isArray(value)) {
    for (const child of value) collectArraysForKey(child, target, result);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === target && Array.isArray(child)) result.push(child);
    collectArraysForKey(child, target, result);
  }
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalValue(child)])
  );
}
