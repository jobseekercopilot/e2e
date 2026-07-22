import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { AiCreditPage } from '../pages/AiCreditPage';
import { ApplicationTrackerPage } from '../pages/ApplicationTrackerPage';
import { DashboardPage } from '../pages/DashboardPage';
import { DocumentGenerationPage } from '../pages/DocumentGenerationPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { JobDetailsPage } from '../pages/JobDetailsPage';
import { JobSeekerProfilePage } from '../pages/job-seeker-profile.page';
import { JobSearchPage, type JobSearchFixture } from '../pages/JobSearchPage';
import { NavigationPage } from '../pages/NavigationPage';
import { RegisterPage } from '../pages/RegisterPage';
import { e2eConfig } from './config';

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
  demoDownloads: string[] = [];
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
  }
}

setWorldConstructor(JobSeekerWorld);
