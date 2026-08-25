import { expect, type Page } from '@playwright/test';

interface ApplicationRecord {
  id?: string;
  status?: string;
}

interface ActivityItem {
  occurredAt?: string;
  text?: string;
}

interface ApplicationSummary {
  documentsGenerated?: number;
  applied?: number;
  interview?: number;
  unsuccessful?: number;
  offer?: number;
  accepted?: number;
  rejectedByUser?: number;
  total?: number;
}

interface CommitmentProgress {
  completedHours?: number;
  percentageComplete?: number;
  remainingHours?: number;
  requiredHours?: number;
}

interface ReportingSummary {
  applicationSummary?: ApplicationSummary;
  activityTimeline?: ActivityItem[];
  commitmentProgress?: CommitmentProgress;
}

const STATUS_HOURS: Record<string, number> = {
  DOCUMENTS_GENERATED: 1,
  APPLIED: 1.5,
  INTERVIEW: 2,
  UNSUCCESSFUL: 0.25,
  REJECTED: 0.25,
};

const NHS_SOURCE_EVIDENCE_MARKER = ' Source evidence: provider=NHS_JOBS';

function count(applications: ApplicationRecord[], ...statuses: string[]): number {
  return applications.filter(application => statuses.includes(application.status ?? '')).length;
}

function expectedSummary(applications: ApplicationRecord[]): Required<ApplicationSummary> {
  return {
    documentsGenerated: count(applications, 'DOCUMENTS_GENERATED'),
    applied: count(applications, 'APPLIED'),
    interview: count(applications, 'INTERVIEW'),
    unsuccessful: count(applications, 'UNSUCCESSFUL', 'REJECTED'),
    offer: count(applications, 'OFFER'),
    accepted: count(applications, 'ACCEPTED'),
    rejectedByUser: count(applications, 'REJECTED_BY_USER'),
    total: applications.length,
  };
}

function publicActivityText(text: string): string {
  const markerIndex = text.indexOf(NHS_SOURCE_EVIDENCE_MARKER);
  return markerIndex >= 0 ? text.slice(0, markerIndex).trimEnd() : text;
}

export class ReportingReconciliationPage {
  constructor(private readonly page: Page) {}

  async reconcile(expectedApplicationCount: number): Promise<void> {
    await this.page.goto('/dashboard');
    const sourceAndReport = await this.page.evaluate(async () => {
      const [applicationsResponse, reportResponse] = await Promise.all([
        fetch('/api/jobs/applications'),
        fetch('/api/v1/reports/summary'),
      ]);
      if (!applicationsResponse.ok || !reportResponse.ok) {
        throw new Error(
          `Reporting reconciliation dependencies returned applications=${applicationsResponse.status}, report=${reportResponse.status}.`
        );
      }
      return {
        applications: await applicationsResponse.json() as unknown,
        report: await reportResponse.json() as unknown,
      };
    });
    const applicationsBody = sourceAndReport.applications;
    const applications = (Array.isArray(applicationsBody)
      ? applicationsBody
      : typeof applicationsBody === 'object' && applicationsBody !== null
        && Array.isArray((applicationsBody as {applications?: unknown}).applications)
        ? (applicationsBody as {applications: unknown[]}).applications
        : []) as ApplicationRecord[];
    const report = sourceAndReport.report as ReportingSummary;
    const expected = expectedSummary(applications);

    expect(applications).toHaveLength(expectedApplicationCount);
    expect(report.applicationSummary).toEqual(expected);

    const completedHours = applications.reduce(
      (total, application) => total + (STATUS_HOURS[application.status ?? ''] ?? 0),
      0,
    );
    expect(report.commitmentProgress?.completedHours).toBe(completedHours);
    const requiredHours = report.commitmentProgress?.requiredHours ?? 35;
    const remainingHours = Math.max(requiredHours - completedHours, 0);
    expect(report.commitmentProgress?.remainingHours).toBe(remainingHours);
    expect(report.commitmentProgress?.percentageComplete).toBe(
      requiredHours === 0 ? 100 : Math.min(Math.round((completedHours * 100) / requiredHours), 100)
    );

    const timeline = report.activityTimeline ?? [];
    for (let index = 1; index < timeline.length; index += 1) {
      expect(Date.parse(timeline[index - 1].occurredAt ?? '')).toBeGreaterThanOrEqual(
        Date.parse(timeline[index].occurredAt ?? '')
      );
    }

    const panel = this.page.getByTestId('reporting-panel');
    await expect(panel).toBeVisible();
    const summary = panel.getByTestId('reporting-summary');
    await expect(summary.locator('.summary-total strong')).toHaveText(String(expected.total));
    const displayedRows: Array<[string, number]> = [
      ['summary-new', expected.documentsGenerated],
      ['summary-applied', expected.applied],
      ['summary-interview', expected.interview],
      ['summary-offer', expected.offer],
      ['summary-unsuccessful', expected.unsuccessful],
    ];
    for (const [className, value] of displayedRows) {
      const row = summary.locator(`.${className}`);
      await expect(row.locator('strong')).toHaveText(String(value));
      await expect(row.locator('em')).toHaveText(
        `${expected.total === 0 ? 0 : Math.round((value / expected.total) * 100)}%`
      );
    }
    const renderedActivity = panel.getByTestId('reporting-activity').locator('li');
    await expect(renderedActivity).toHaveCount(timeline.length);
    for (let index = 0; index < timeline.length; index += 1) {
      if (timeline[index].text) {
        const sourceText = timeline[index].text as string;
        await expect(renderedActivity.nth(index)).toContainText(publicActivityText(sourceText));
        if (sourceText.includes(NHS_SOURCE_EVIDENCE_MARKER)) {
          await expect(renderedActivity.nth(index)).not.toContainText('canonicalJobId=');
          await expect(renderedActivity.nth(index)).not.toContainText('listingUrl=');
        }
      }
      await expect(renderedActivity.nth(index).locator('time')).not.toHaveText('');
    }

    const desktopContainment = await panel.evaluate(element => {
      const sidebar = element.closest('#right-sidebar');
      if (!sidebar) throw new Error('Reporting panel is not inside the desktop right sidebar.');
      const sidebarRight = sidebar.getBoundingClientRect().right;
      const reportingRight = element.getBoundingClientRect().right;
      const cardRights = Array.from(
        element.querySelectorAll<HTMLElement>('.reporting-header, .reporting-card')
      ).map(card => card.getBoundingClientRect().right);
      return {
        cardRights,
        documentWidth: document.documentElement.scrollWidth,
        reportingRight,
        sidebarRight,
        viewportWidth: window.innerWidth,
      };
    });
    expect(desktopContainment.reportingRight).toBeLessThanOrEqual(
      desktopContainment.sidebarRight + 1
    );
    for (const cardRight of desktopContainment.cardRights) {
      expect(cardRight).toBeLessThanOrEqual(desktopContainment.sidebarRight + 1);
    }
    expect(desktopContainment.documentWidth).toBeLessThanOrEqual(
      desktopContainment.viewportWidth + 1
    );
    if (timeline.length === 0) {
      await expect(panel.getByText('No activity yet.', {exact: true})).toBeVisible();
      await expect(panel.getByText('No journal entries yet.', {exact: true})).toBeVisible();
    }
  }
}
