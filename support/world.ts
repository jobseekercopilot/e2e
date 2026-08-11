import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { AiCreditPage } from '../pages/AiCreditPage';
import { ApplicationDocumentJourneyPage, type DocumentChoice, type DocumentPurpose } from '../pages/ApplicationDocumentJourneyPage';
import { ApplicationTrackerPage } from '../pages/ApplicationTrackerPage';
import { DashboardPage } from '../pages/DashboardPage';
import { DocumentGenerationPage } from '../pages/DocumentGenerationPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { JobDetailsPage } from '../pages/JobDetailsPage';
import { JobSeekerProfilePage } from '../pages/job-seeker-profile.page';
import { JobSearchPage, type JobSearchFixture } from '../pages/JobSearchPage';
import { NavigationPage } from '../pages/NavigationPage';
import { RegisterPage } from '../pages/RegisterPage';
import { PasswordRecoveryPage } from '../pages/PasswordRecoveryPage';
import { ProductShowcasePage } from '../pages/ProductShowcasePage';
import { ReportingReconciliationPage } from '../pages/ReportingReconciliationPage';
import { StabilisationPage } from '../pages/StabilisationPage';
import { e2eConfig } from './config';
import { createRunId } from './synthetic-data';
import type { NamedState, NamedStateDefinition, SystemDataClient } from './system-data';
import type { ZeroCreditGenerationFirewall } from './stabilisation-runtime-safety';
import type { BrowserNetworkSample } from './artifacts';
import type { ShowcaseCandidate } from './showcase-data';

export interface QualificationFixture {
  name: string;
  institution: string;
  grade: string;
  completed: string;
}

export interface WorkHistoryFixture {
  jobTitle: string;
  employer: string;
  from: string;
  to: string;
  description: string;
}

export interface DemoUser {
  fullName: string;
  email: string;
  password: string;
  skills: string[];
  targetRoles: string[];
  weeklyHours: string;
  qualification: QualificationFixture;
  workHistory: WorkHistoryFixture[];
  homeLocation: string;
  commuteRange: string;
}

export class JobSeekerWorld extends World {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  demoUser?: DemoUser;
  jobSearch?: JobSearchFixture;
  documentGenerationAttempted?: 'applicationDocuments';
  documentGenerationSuccessShown = false;
  showcaseCandidate?: ShowcaseCandidate;
  showcaseVideoStartedAtMs?: number;
  readonly showcaseMarkers: Array<{ section: string; seconds: number }> = [];
  demoDownloads: string[] = [];
  readonly runId = createRunId();
  readonly syntheticUsers = new Set<string>();
  registrationRequestCount = 0;
  profileUpdateRequestCount = 0;
  tracingStarted = false;
  scenarioStartedAt = '';
  readonly consoleErrors: string[] = [];
  readonly networkErrors: BrowserNetworkSample[] = [];
  readonly networkSamples: BrowserNetworkSample[] = [];
  namedState?: NamedState;
  namedStateDefinition?: NamedStateDefinition;
  systemDataClient?: SystemDataClient;
  readonly config = e2eConfig;

  registerPage?: RegisterPage;
  profilePage?: JobSeekerProfilePage;
  dashboardPage?: DashboardPage;
  navigationPage?: NavigationPage;
  jobSearchPage?: JobSearchPage;
  jobDetailsPage?: JobDetailsPage;
  documentGenerationPage?: DocumentGenerationPage;
  documentsPage?: DocumentsPage;
  applicationTrackerPage?: ApplicationTrackerPage;
  aiCreditPage?: AiCreditPage;
  passwordRecoveryPage?: PasswordRecoveryPage;
  productShowcasePage?: ProductShowcasePage;
  reportingReconciliationPage?: ReportingReconciliationPage;
  stabilisationPage?: StabilisationPage;
  applicationDocumentJourneyPage?: ApplicationDocumentJourneyPage;
  applicationDocumentChoices?: Record<DocumentPurpose, DocumentChoice>;
  zeroCreditGenerationFirewall?: ZeroCreditGenerationFirewall;

  constructor(options: IWorldOptions) {
    super(options);
  }

  initialisePages(page: Page): void {
    this.page = page;
    this.registerPage = new RegisterPage(page, this.config.baseUrl);
    this.profilePage = new JobSeekerProfilePage(page);
    this.dashboardPage = new DashboardPage(page);
    this.navigationPage = new NavigationPage(page);
    this.jobSearchPage = new JobSearchPage(page);
    this.jobDetailsPage = new JobDetailsPage(page);
    this.documentGenerationPage = new DocumentGenerationPage(page);
    this.documentsPage = new DocumentsPage(page);
    this.applicationTrackerPage = new ApplicationTrackerPage(page);
    this.aiCreditPage = new AiCreditPage(page);
    this.applicationDocumentJourneyPage = new ApplicationDocumentJourneyPage(page, this.config.baseUrl);
    this.passwordRecoveryPage = new PasswordRecoveryPage(page, this.config.baseUrl);
    this.productShowcasePage = new ProductShowcasePage(page);
    this.reportingReconciliationPage = new ReportingReconciliationPage(page);
    this.stabilisationPage = new StabilisationPage(
      page,
      this.config.baseUrl,
      this.runId,
      this.config.stabilisationArtifactDir,
      this.config.stabilisationManifest
    );
  }

  registerSyntheticUser(email: string): void {
    this.syntheticUsers.add(email);
  }

  markShowcaseSection(section: string): void {
    if (this.showcaseVideoStartedAtMs === undefined) {
      throw new Error('The showcase video clock was not initialised.');
    }
    if (!/^[A-Z][A-Z0-9_-]{1,40}$/.test(section)) {
      throw new Error(`Invalid showcase section: ${section}`);
    }
    this.showcaseMarkers.push({
      section,
      seconds: (Date.now() - this.showcaseVideoStartedAtMs) / 1000
    });
  }
}

setWorldConstructor(JobSeekerWorld);
