import { expect, type Browser, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ApplicationDocumentJourneyPage,
  type ConfirmedGenerationEvidence,
  type PreferredJob,
} from './ApplicationDocumentJourneyPage';
import { PUBLIC_NAMED_STATE_PASSWORD } from '../support/demo-data';
import type { NamedStateDefinition } from '../support/system-data';

type PersonaIdentity = NamedStateDefinition['identities'][number];

interface ProfileShape {
  bytes: number;
  evidenceSnapshot: string;
  qualifications: number;
  roles: number;
  skills: number;
}

const PERSONA_GENERATION_EVIDENCE: Record<string, ConfirmedGenerationEvidence> = {
  'minimal-profile': {
    title: 'Community reception rota improvement',
    role: 'Administrative volunteer',
    description: 'Organised a fictional weekly reception rota, maintained accurate Microsoft Office records and responded to routine visitor questions with clear customer service.',
    startDate: '2025-03-01',
    endDate: '2026-02-28',
  },
  'typical-profile': {
    title: 'Accessible service workflow delivery',
    role: 'Software developer',
    description: 'Delivered a fictional Java and Angular service workflow using Spring Boot, REST APIs, automated tests and accessible interface components within a collaborative team.',
    startDate: '2024-04-01',
    endDate: '2026-07-01',
  },
  'rich-profile': {
    title: 'Order service reliability programme',
    role: 'Senior software engineer',
    description: 'Led a fictional reliability improvement across Java services, contract tests and deployment dashboards while mentoring four engineers and reducing deployment lead time.',
    startDate: '2023-01-01',
    endDate: '2026-06-30',
  },
  'very-rich-profile': {
    title: 'Regulated platform reliability review',
    role: 'Principal platform consultant',
    description: 'Directed a fictional twelve-service platform review, facilitated architecture decisions and introduced reliability controls that reduced priority incidents by 38 percent.',
    startDate: '2025-04-01',
    endDate: '2026-07-31',
  },
  'uploaded-cv-first': {
    title: 'Supplier statement reconciliation improvement',
    role: 'Finance administrator',
    description: 'Improved a fictional invoice and supplier-statement process using bookkeeping knowledge, Excel and Xero while continuing to answer customer account queries accurately.',
    startDate: '2024-01-01',
    endDate: '2026-06-30',
  },
  'manual-profile-first': {
    title: 'Four-workstream governance coordination',
    role: 'Project support officer',
    description: 'Coordinated a fictional four-workstream programme by maintaining plans, risks, actions and budget reports and preparing clear governance updates for suppliers and stakeholders.',
    startDate: '2023-01-01',
    endDate: '2026-07-31',
  },
  'career-changer': {
    title: 'Nine-colleague curriculum change',
    role: 'Secondary school teacher',
    description: 'Coordinated a fictional curriculum change involving nine colleagues by planning milestones, facilitating workshops, tracking risks and reporting progress to families and school leaders.',
    startDate: '2025-01-01',
    endDate: '2026-07-31',
  },
};

const PERSONA_REVIEW_JOBS: Record<string, PreferredJob> = {
  'minimal-profile': {
    title: 'Administrative Assistant',
    company: 'Midland Community Services',
  },
  'typical-profile': {
    title: 'Java Software Developer',
    company: 'Northstar Digital Labs',
  },
  'rich-profile': {
    title: 'Senior Software Engineer',
    company: 'Mersey Reliability Systems',
  },
  'very-rich-profile': {
    title: 'Platform Architect',
    company: 'Thames Regulated Platforms',
  },
  'uploaded-cv-first': {
    title: 'Accounts Assistant',
    company: 'Yorkshire Neighbourhood Homes',
  },
  'manual-profile-first': {
    title: 'Project Coordinator',
    company: 'Bristol Learning Partnership',
  },
  'career-changer': {
    title: 'Programme Support Officer',
    company: 'North West Skills Network',
  },
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

    const reviewDirectory = process.env['RELEASE_REVIEW_DIR']?.trim();
    const reviewBundles: Array<Record<string, unknown>> = [];
    const reviewIndex: string[] = [];
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
        const generationEvidence = PERSONA_GENERATION_EVIDENCE[identity.key];
        if (!generationEvidence) throw new Error(`No generation evidence is defined for ${identity.key}.`);
        const preferredJob = PERSONA_REVIEW_JOBS[identity.key];
        if (!preferredJob) throw new Error(`No review job is defined for ${identity.key}.`);
        await journey.startJourney('GENERATE', preferredJob, {
          generationEvidence,
          preserveProfileLocation: true,
        });
        await this.assertMeaningfulSearch(page);
        await journey.chooseDocuments({CV: 'GENERATE', COVER_LETTER: 'GENERATE'});
        await journey.completeGeneration(['CV', 'COVER_LETTER'], generationEvidence.title);
        await journey.assertApplication({CV: 'GENERATE', COVER_LETTER: 'GENERATE'});
        if (reviewDirectory) {
          const bundle = await journey.exportGeneratedReviewBundle(
            reviewDirectory,
            identity.key,
            identity.displayName,
          );
          reviewBundles.push({
            candidate: {
              displayName: identity.displayName,
              key: identity.key,
            },
            generationEvidence,
            targetJob: preferredJob,
            ...bundle,
          });
          reviewIndex.push(
            `- **${identity.displayName} (${identity.key})** — ${bundle.application.title} at `
            + `${bundle.application.company}; CV and cover letter in PDF/DOCX; `
            + `grounding evidence: \`${bundle.groundingReport}\`.`,
          );
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
    if (reviewDirectory) {
      await writeFile(
        path.join(reviewDirectory, 'manifest.json'),
        `${JSON.stringify({
          generatedAt: new Date().toISOString(),
          namedState: 'REAL_WORLD_PERSONAS',
          dataset: 'uk-software-developer-demo:1.2.0',
          personas: reviewBundles,
          schemaVersion: 'release-review-v1',
        }, null, 2)}\n`,
      );
      await writeFile(
        path.join(reviewDirectory, 'README.md'),
        `# Job Seeker Copilot release-candidate document review\n\n`
        + `Generated through the full local browser journey from governed, wholly synthetic `
        + `personas and vacancies. Each persona has a CV and cover letter in PDF and DOCX. `
        + `The associated grounding report records the exact application, immutable document `
        + `references, evidence-snapshot and claim-ledger digests, generation status and billing `
        + `outcome without test secrets.\n\n`
        + `Dataset: \`uk-software-developer-demo:1.2.0\`  \n`
        + `Named state: \`REAL_WORLD_PERSONAS\`  \n`
        + `Artifacts: 28 documents plus 7 grounding reports\n\n`
        + `## Scenarios\n\n${reviewIndex.join('\n')}\n`,
      );
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

}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
