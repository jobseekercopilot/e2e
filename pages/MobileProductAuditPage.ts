import {expect, type Browser, type Locator, type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {ApplicationDocumentJourneyPage} from './ApplicationDocumentJourneyPage';
import {NavigationPage} from './NavigationPage';
import {
  PERSONA_GENERATION_EVIDENCE,
  PERSONA_REVIEW_JOBS,
  type PersonaIdentity,
} from './PersonaBrowserReplayPage';
import {PUBLIC_NAMED_STATE_PASSWORD} from '../support/demo-data';

interface MobilePersona {
  key: string;
  width: number;
  height: number;
}

const MOBILE_PERSONAS: MobilePersona[] = [
  {key: 'minimal-profile', width: 320, height: 740},
  {key: 'typical-profile', width: 360, height: 800},
  {key: 'rich-profile', width: 375, height: 812},
  {key: 'uploaded-cv-first', width: 390, height: 844},
  {key: 'career-changer', width: 412, height: 915},
];

const REVIEW_DIRECTORY = path.resolve(__dirname, '..', 'docs/release-review/mobile');
const DESKTOP_REVIEW_DIRECTORY = path.resolve(__dirname, '..', 'docs/release-review/desktop');

export class MobileProductAuditPage {
  constructor(private readonly browser: Browser, private readonly baseUrl: string) {}

  async auditPhones(identities: PersonaIdentity[]): Promise<void> {
    await mkdir(REVIEW_DIRECTORY, {recursive: true});
    const identityByKey = new Map(identities.map(identity => [identity.key, identity]));

    for (const persona of MOBILE_PERSONAS) {
      const identity = identityByKey.get(persona.key);
      if (!identity) throw new Error(`The mobile audit identity ${persona.key} is unavailable.`);
      await this.auditPersona(identity, persona);
    }
  }

  async auditTablet(identities: PersonaIdentity[]): Promise<void> {
    await mkdir(REVIEW_DIRECTORY, {recursive: true});
    const identityByKey = new Map(identities.map(identity => [identity.key, identity]));
    const tabletIdentity = identityByKey.get('typical-profile');
    if (!tabletIdentity) throw new Error('The tablet audit identity is unavailable.');
    await this.auditTabletPersona(tabletIdentity);
  }

  async auditDesktop(identities: PersonaIdentity[]): Promise<void> {
    await mkdir(DESKTOP_REVIEW_DIRECTORY, {recursive: true});
    const identity = identities.find(candidate => candidate.key === 'typical-profile');
    if (!identity) throw new Error('The desktop audit identity is unavailable.');
    const context = await this.browser.newContext({
      baseURL: this.baseUrl,
      viewport: {width: 1440, height: 1000},
      deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage();
      await this.signIn(page, identity);
      await this.assertMobileSurface(page, 'desktop dashboard');
      await page.screenshot({
        path: path.join(DESKTOP_REVIEW_DIRECTORY, 'typical-profile-1440-dashboard.png'),
        fullPage: false,
        animations: 'disabled',
      });
      await page.goto('/payment');
      await expect(page.getByRole('heading', {name: 'Document generation packs'})).toBeVisible();
      await expect(page.getByRole('heading', {name: /\d+ generations available/}))
        .toBeVisible({timeout: 20_000});
      await this.assertMobileSurface(page, 'desktop pricing');
      await page.screenshot({
        path: path.join(DESKTOP_REVIEW_DIRECTORY, 'typical-profile-1440-pricing.png'),
        fullPage: false,
        animations: 'disabled',
      });
    } finally {
      await context.close();
    }
  }

  private async auditPersona(identity: PersonaIdentity, persona: MobilePersona): Promise<void> {
    const context = await this.browser.newContext({
      baseURL: this.baseUrl,
      viewport: {width: persona.width, height: persona.height},
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    });
    try {
      const page = await context.newPage();
      await this.signIn(page, identity);
      await this.assertMobileSurface(page, `${identity.key} dashboard`);
      await this.screenshot(page, identity.key, persona.width, 'profile-dashboard');

      const evidence = PERSONA_GENERATION_EVIDENCE[identity.key];
      const preferredJob = PERSONA_REVIEW_JOBS[identity.key];
      if (!evidence || !preferredJob) {
        throw new Error(`Mobile generation data is unavailable for ${identity.key}.`);
      }
      const journey = new ApplicationDocumentJourneyPage(page, this.baseUrl);
      await journey.startJourney('GENERATE', preferredJob, {
        generationEvidence: evidence,
        preserveProfileLocation: true,
      });
      await this.assertMobileSurface(page, `${identity.key} job detail`);
      await this.screenshot(page, identity.key, persona.width, 'job-details-document-choice');

      await journey.chooseDocuments({CV: 'GENERATE', COVER_LETTER: 'GENERATE'});
      await expect(page.getByTestId('generation-evidence-selector')).toBeVisible();
      await this.assertMobileSurface(page, `${identity.key} generation review`);
      if (identity.key === 'typical-profile') {
        await this.screenshot(page, identity.key, persona.width, 'generation-review');
      }
      await journey.completeGeneration(['CV', 'COVER_LETTER'], evidence.title);
      await journey.assertApplication({CV: 'GENERATE', COVER_LETTER: 'GENERATE'});
      await journey.assertSelectedGenerationSpentCredit(2);
      await this.assertMobileSurface(page, `${identity.key} generated documents`);
      await this.screenshot(page, identity.key, persona.width, 'generated-cv-cover-letter');

      const navigation = new NavigationPage(page);
      await navigation.goToApplications();
      await this.assertMobileSurface(page, `${identity.key} applications`);
      if (identity.key === 'typical-profile' || identity.key === 'career-changer') {
        await this.screenshot(page, identity.key, persona.width, 'application-tracking');
      }

      await navigation.goToDocuments();
      await this.assertMobileSurface(page, `${identity.key} documents`);
      if (identity.key === 'typical-profile') {
        await this.screenshot(page, identity.key, persona.width, 'document-history');
      }

      await page.goto('/payment');
      await expect(page.getByRole('heading', {name: 'Document generation packs'})).toBeVisible();
      await expect(page.getByRole('heading', {name: /\d+ generations available/}))
        .toBeVisible({timeout: 20_000});
      await this.assertMobileSurface(page, `${identity.key} pricing`);
      if (identity.key === 'typical-profile' || identity.key === 'uploaded-cv-first') {
        await this.screenshot(page, identity.key, persona.width, 'allowance-pricing');
      }

      await page.goto('/payment/history');
      await expect(page.getByRole('heading', {name: 'Generation history'}).first()).toBeVisible();
      await this.assertMobileSurface(page, `${identity.key} generation history`);
      if (identity.key === 'typical-profile') {
        await this.screenshot(page, identity.key, persona.width, 'generation-allowance-history');
      }

      if (identity.key === 'career-changer') {
        await journey.exportGeneratedReviewBundle(
          path.join(REVIEW_DIRECTORY, 'downloads'),
          'career-changer-mobile',
          identity.displayName,
        );
        await navigation.signOut();
        await this.signIn(page, identity);
        await navigation.goToApplications();
        await expect(page.getByTestId('workspace-panel-applications'))
          .toContainText(preferredJob.title);
        await this.assertMobileSurface(page, `${identity.key} returning user`);
        await this.screenshot(page, identity.key, persona.width, 'returning-user-persistence');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown mobile audit failure.';
      throw new Error(`Mobile persona ${identity.key} failed at ${persona.width}px: ${message}`, {cause: error});
    } finally {
      await context.close();
    }
  }

  private async auditTabletPersona(identity: PersonaIdentity): Promise<void> {
    const context = await this.browser.newContext({
      baseURL: this.baseUrl,
      viewport: {width: 768, height: 1024},
      deviceScaleFactor: 1,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await this.signIn(page, identity);
      await this.assertMobileSurface(page, 'tablet dashboard');
      await this.screenshot(page, identity.key, 768, 'tablet-dashboard');
      await page.goto('/payment');
      await expect(page.getByRole('heading', {name: 'Document generation packs'})).toBeVisible();
      await expect(page.getByRole('heading', {name: /\d+ generations available/}))
        .toBeVisible({timeout: 20_000});
      await this.assertMobileSurface(page, 'tablet pricing');
      await this.screenshot(page, identity.key, 768, 'tablet-pricing');
    } finally {
      await context.close();
    }
  }

  private async signIn(page: Page, identity: PersonaIdentity): Promise<void> {
    await page.goto('/');
    await page.getByTestId('sign-in-tab')
      .or(page.locator('#tab-btn-signin'))
      .or(page.getByRole('button', {name: /sign in/i}))
      .first()
      .click();
    const form = page.locator('#mode-signin-segment form');
    await form.getByLabel(/email address/i).fill(identity.email);
    await form.getByLabel(/^password$/i).fill(PUBLIC_NAMED_STATE_PASSWORD);
    const loginResponse = page.waitForResponse(response =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/auth/login');
    await form.getByRole('button', {name: 'Sign in', exact: true}).click();
    const login = await loginResponse;
    expect(login.ok(), `${identity.key} mobile login returned HTTP ${login.status()}.`).toBe(true);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('workspace-tab-search')).toBeVisible();
    const toast = page.locator('#toast-notification');
    if (await toast.isVisible().catch(() => false)) {
      await toast.waitFor({state: 'hidden', timeout: 10_000});
    }
  }

  private async assertMobileSurface(page: Page, stage: string): Promise<void> {
    const dimensions = await page.evaluate(() => {
      const viewport = window.innerWidth;
      const overflowing = [...document.querySelectorAll<HTMLElement>('body *')]
        .map(element => {
          const box = element.getBoundingClientRect();
          return {
            element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${
              element.classList.length > 0 ? `.${[...element.classList].slice(0, 3).join('.')}` : ''
            }`,
            left: Math.round(box.left),
            right: Math.round(box.right),
            width: Math.round(box.width),
          };
        })
        .filter(box => box.width > 0 && (box.left < -1 || box.right > viewport + 1))
        .sort((a, b) => (b.right - viewport) - (a.right - viewport))
        .slice(0, 8);
      return {
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        overflowing,
        viewport,
      };
    });
    expect(
      Math.max(dimensions.body, dimensions.document),
      `${stage} must not scroll horizontally; overflow candidates: ${JSON.stringify(dimensions.overflowing)}`,
    ).toBeLessThanOrEqual(dimensions.viewport + 1);

    const controls = page.locator([
      '#btn-profile-dropdown',
      '[data-testid="workspace-tab-search"]',
      '[data-testid="workspace-tab-applications"]',
      '[data-testid="workspace-tab-documents"]',
      '.purchase-button',
      '[data-testid="generate-documents-button"]',
      '[data-testid="track-application-button"]',
      '.card-caret-button',
      'button[type="submit"]',
    ].join(','));
    await this.assertPracticalTouchTargets(controls, stage);
  }

  private async assertPracticalTouchTargets(controls: Locator, stage: string): Promise<void> {
    const undersized = await controls.evaluateAll(elements => elements
      .filter(element => {
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
      })
      .map(element => {
        const box = element.getBoundingClientRect();
        return {
          height: Math.round(box.height),
          label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 80) || element.tagName,
          width: Math.round(box.width),
        };
      })
      .filter(control => control.height < 44 || control.width < 44));
    expect(undersized, `${stage} has undersized primary touch controls`).toEqual([]);
  }

  private async screenshot(page: Page, key: string, width: number, stage: string): Promise<void> {
    await page.screenshot({
      path: path.join(REVIEW_DIRECTORY, `${key}-${width}-${stage}.png`),
      fullPage: false,
      animations: 'disabled',
    });
  }
}
