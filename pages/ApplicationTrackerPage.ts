import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class ApplicationTrackerPage extends BasePage {
  private lastChangedApplication?: {
    title: string;
    company: string;
    status: 'interview' | 'offer';
  };

  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.clickFramed(
      this.byTestId('workspace-tab-applications')
        .or(this.page.getByRole('button', { name: /my applications|track and manage/i }))
        .first()
    );
    await expect(this.byTestId('applications-workspace').or(this.page.getByText(/No applications in this view|Application status filters/i)).first()).toBeVisible();
  }

  async waitForApplications(): Promise<void> {
    const cards = this.applicationCards();
    await expect(cards.first(), 'Application fixture did not render any application card.')
      .toBeVisible({ timeout: 20_000 });
    const focusCard = await this.requireVisibleLocator(
      cards,
      'Application fixture rendered no visible application card.',
      1
    );
    await this.spotlight(focusCard);
    await this.pauseBeforeFeature();
    await this.clearSpotlight();
  }

  async expectSpecialistApplications(): Promise<void> {
    await expect(
      this.applicationCardFor('Community Staff Nurse', 'Example NHS Foundation Trust')
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      this.applicationCardFor('Software Developer Apprentice', 'Example Digital Ltd')
    ).toBeVisible({ timeout: 20_000 });
  }

  async showShowcaseApplication(title: string, company: string): Promise<void> {
    await this.open();
    let card = this.applicationCardFor(title, company);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await this.intentionalScrollNearCenter(card);
    await this.spotlight(card);
    await this.pauseAfterFeature();

    const documents = card.getByTestId('application-documents');
    await this.clickFramed(documents.locator('summary'));
    const selections = documents.locator('select');
    await expect(selections).toHaveCount(2, {timeout: 30_000});
    const selectedDocumentIds: string[] = [];
    for (let index = 0; index < 2; index += 1) {
      const selection = selections.nth(index);
      const approvedVersion = selection.locator('option:not([value=""])').first();
      await expect(approvedVersion).toBeAttached({timeout: 30_000});
      const documentId = await approvedVersion.getAttribute('value');
      expect(documentId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      await selection.selectOption(documentId!);
      selectedDocumentIds.push(documentId!);
      await expect(selection).toHaveValue(documentId!);
      await expect(selection.locator('option:checked')).toContainText(/Version 1/);
    }
    const saveSelections = documents.getByRole('button', {
      name: 'Save document selections',
      exact: true,
    });
    await expect(saveSelections).toBeEnabled();
    const saveCompleted = this.page.waitForResponse(response =>
      response.request().method() === 'PUT'
      && response.url().includes('/document-selections')
      && response.ok(),
      {timeout: 30_000}
    );
    await saveSelections.click();
    await saveCompleted;
    const authoritativeApplications = this.page.waitForResponse(response =>
      response.request().method() === 'GET'
      && response.url().includes('/api/jobs/applications')
      && response.ok(),
      {timeout: 30_000}
    );
    await this.open();
    const applicationList = await authoritativeApplications;
    const records = await applicationList.json() as Array<{
      jobTitle?: string;
      companyName?: string;
      cvDocumentId?: string;
      coverLetterDocumentId?: string;
      cvDocumentReference?: {documentId?: string};
      coverLetterDocumentReference?: {documentId?: string};
    }>;
    const authoritativeRecord = records.find(record =>
      record.jobTitle === title && record.companyName === company
    );
    expect(authoritativeRecord?.cvDocumentReference?.documentId
      ?? authoritativeRecord?.cvDocumentId).toBe(selectedDocumentIds[0]);
    expect(authoritativeRecord?.coverLetterDocumentReference?.documentId
      ?? authoritativeRecord?.coverLetterDocumentId).toBe(selectedDocumentIds[1]);
    const authoritativeCard = this.applicationCardFor(title, company);
    await expect(authoritativeCard).toBeVisible({timeout: 30_000});
    const authoritativeDocuments = authoritativeCard.getByTestId('application-documents');
    await this.clickFramed(authoritativeDocuments.locator('summary'));
    const authoritativeSelections = authoritativeDocuments.locator('select');
    await expect(authoritativeSelections).toHaveCount(2, {timeout: 30_000});
    for (let index = 0; index < 2; index += 1) {
      await expect(authoritativeSelections.nth(index)).not.toHaveValue('');
      await expect(authoritativeSelections.nth(index).locator('option:checked'))
        .toContainText(/Version 1/);
    }
    await this.pauseAfterFeature();
    await this.clearSpotlight();

    await this.updateSpecificApplicationStatus(title, company, 'Mark as Applied', 'applied');
    await this.updateSpecificApplicationStatus(title, company, 'Mark Interview', 'interview');

    card = this.applicationCardFor(title, company);
    const frozenDocuments = card.getByTestId('application-documents');
    if (!(await frozenDocuments.getAttribute('open'))) {
      await this.clickFramed(frozenDocuments.locator('summary'));
    }
    await expect(frozenDocuments.getByText('CV used · Version 1', {exact: true}))
      .toBeVisible({timeout: 30_000});
    await expect(frozenDocuments.getByText('Cover letter used · Version 1', {exact: true}))
      .toBeVisible({timeout: 30_000});
    await this.intentionalScrollNearCenter(card);
    await this.spotlight(card);
    await expect(card.locator('.status-interview')).toBeVisible();
    await expect(card.getByText('Mark Applied', { exact: true })).toBeVisible();
    await expect(card.getByText('Interview', { exact: true }).first()).toBeVisible();
    const evidence = card.getByTestId('evidence-used');
    if (await evidence.isVisible().catch(() => false)) {
      await this.clickFramed(evidence.locator('summary'));
      await expect(evidence.getByText(/Profile revision|Claim ledger|Source snapshot/i).first()).toBeVisible();
    }
    await this.pauseAfterFeature();
    await this.clearSpotlight();
  }

  async expectShowcaseApplicationPersisted(
    title: string,
    company: string,
    status: 'interview' | 'offer'
  ): Promise<void> {
    await this.open();
    const card = this.applicationCardFor(title, company);
    await expect(card).toBeVisible({timeout: 30_000});
    await expect(card.locator(`.status-${status}`)).toBeVisible();
    const documents = card.getByTestId('application-documents');
    if (!(await documents.getAttribute('open'))) {
      await this.clickFramed(documents.locator('summary'));
    }
    await expect(documents.getByText('CV used · Version 1', {exact: true}))
      .toBeVisible({timeout: 30_000});
    await expect(documents.getByText('Cover letter used · Version 1', {exact: true}))
      .toBeVisible({timeout: 30_000});
  }

  async changeFirstApplicationStatus(status: 'Applied' | 'Interview' | 'Offer'): Promise<void> {
    await (status === 'Offer'
      ? this.moveInterviewApplicationToOffer()
      : this.moveApplicationToInterview());
  }

  async moveApplicationToInterview(): Promise<void> {
    await this.updateApplicationStatus(['applied'], /Interview/i, 'interview');
  }

  async moveInterviewApplicationToOffer(): Promise<void> {
    await this.updateApplicationStatus(['interview'], /Offer/i, 'offer');
  }

  async focusApplicationWithStatus(status: RegExp): Promise<void> {
    const knownStatus = this.statusSlug(status);
    const card = knownStatus
      ? await this.cardWithCurrentStatus([knownStatus])
      : await this.cardWithStatus(status);
    await expect(card, `No visible application matched ${status}.`)
      .toBeVisible({ timeout: 20_000 });
    await this.spotlight(card);
    await this.pauseAfterFeature();
    await this.clearSpotlight();
  }

  async expectLastChangedStatusAfterRefresh(
    expectedStatus: 'interview' | 'offer'
  ): Promise<void> {
    const changed = this.lastChangedApplication;
    if (!changed || changed.status !== expectedStatus) {
      throw new Error(`No application was changed to ${expectedStatus} in this scenario.`);
    }

    const refresh = this.byTestId('applications-workspace')
      .getByRole('button', { name: 'Refresh', exact: true });
    await expect(refresh, 'Application refresh control is missing.').toBeVisible();
    const refreshedApplications = this.page.waitForResponse(
      response => response.request().method() === 'GET'
        && new URL(response.url()).pathname === '/api/jobs/applications',
      { timeout: 20_000 }
    );
    await this.clickFramed(refresh);
    const response = await refreshedApplications;
    if (!response.ok()) {
      throw new Error(`Application refresh failed with HTTP ${response.status()}.`);
    }

    const persisted = this.applicationCardFor(changed.title, changed.company);
    await expect(
      persisted.locator(`.status-${expectedStatus}`).first(),
      `Application status ${expectedStatus} did not persist after refresh.`
    ).toBeVisible({ timeout: 20_000 });
  }

  private async updateApplicationStatus(
    currentStatuses: string[],
    actionName: RegExp,
    completedStatus: 'interview' | 'offer'
  ): Promise<void> {
    const card = await this.cardWithCurrentStatus(currentStatuses);
    await expect(
      card,
      `No visible application had an allowed starting status: ${currentStatuses.join(', ')}.`
    ).toBeVisible({ timeout: 20_000 });

    await this.spotlight(card);
    await this.pauseBeforeFeature();
    const title = (await card.locator('h3').first().innerText()).trim();
    const company = (await card.locator('.application-meta span').first().innerText()).trim();

    const summary = card.locator('summary').filter({ hasText: /View Application/i }).first();
    if (await summary.isVisible().catch(() => false)) {
      await this.clickFramed(summary);
    }

    const action = card.getByRole('button', { name: actionName }).first();
    if (await action.count() === 0) {
      await this.clearSpotlight();
      throw new Error(
        `Application action ${actionName} is missing for ${title} at ${company}.`
      );
    }
    await expect(
      action,
      `Application action ${actionName} is missing for ${title} at ${company}.`
    ).toBeVisible();

    const statusResponse = this.page.waitForResponse(response =>
      response.request().method() === 'PATCH'
      && /\/api\/jobs\/applications\/[^/]+\/status$/.test(new URL(response.url()).pathname),
      { timeout: 20_000 }
    );
    await this.clickFramed(action);
    const response = await statusResponse;
    expect(
      response.ok(),
      `Application status ${completedStatus} failed with HTTP ${response.status()}.`
    ).toBeTruthy();
    const updatedCard = this.applicationCardFor(title, company);
    await expect(updatedCard.locator(`.status-${completedStatus}`).first()).toBeVisible({ timeout: 20_000 });
    await this.spotlight(updatedCard);
    await this.pauseAfterFeature();
    await this.clearSpotlight();
    this.lastChangedApplication = {
      title,
      company,
      status: completedStatus
    };
  }

  private async updateSpecificApplicationStatus(
    title: string,
    company: string,
    actionLabel: string,
    statusClass: string
  ): Promise<void> {
    const card = this.applicationCardFor(title, company);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await this.intentionalScrollNearCenter(card);
    const menu = card.locator('details.actions-menu');
    if (!(await menu.getAttribute('open'))) await this.clickFramed(menu.locator('summary'));
    const response = this.page.waitForResponse(candidate =>
      candidate.request().method() === 'PATCH'
      && /\/api\/jobs\/applications\/[^/]+\/status$/.test(new URL(candidate.url()).pathname));
    await this.clickFramed(card.getByRole('button', { name: actionLabel, exact: true }));
    expect((await response).ok(), `${actionLabel} must update the showcase application.`).toBeTruthy();
    await expect(this.applicationCardFor(title, company).locator(`.status-${statusClass}`))
      .toBeVisible({ timeout: 20_000 });
  }

  private async cardWithStatus(status: RegExp) {
    const cards = this.applicationCards();
    await expect(
      cards.first(),
      'Application fixture did not render any application card.'
    ).toBeVisible({ timeout: 20_000 });
    const matching = cards.filter({ hasText: status });
    return this.requireVisibleLocator(
      matching,
      `No visible application matched status ${status}.`,
      1
    );
  }

  private async cardWithCurrentStatus(statuses: string[]) {
    const cards = this.applicationCards();
    await expect(
      cards.first(),
      'Application fixture did not render any application card.'
    ).toBeVisible({ timeout: 20_000 });
    for (const status of statuses) {
      const matching = cards.filter({ has: this.page.locator(`.status-${status}`) });
      const visibleMatching = await this.visibleLocator(matching, 1);
      if (visibleMatching) {
        return visibleMatching;
      }
    }

    throw new Error(
      `No visible application matched an allowed current status: ${statuses.join(', ')}.`
    );
  }

  private applicationCards() {
    return this.byTestId('application-card').or(this.page.locator('.application-card'));
  }

  private applicationCardFor(title: string, company: string) {
    return this.applicationCards().filter({ hasText: title }).filter({ hasText: company }).first();
  }

  private statusSlug(status: RegExp): string | undefined {
    const source = status.source.toLowerCase();
    if (source.includes('interview')) {
      return 'interview';
    }
    if (source.includes('offer')) {
      return 'offer';
    }
    if (source.includes('applied')) {
      return 'applied';
    }
    return undefined;
  }

  private async visibleLocator(locator: Locator, preferredIndex = 0): Promise<Locator | undefined> {
    const visible: Locator[] = [];
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) {
        visible.push(item);
      }
    }
    if (visible.length === 0) return undefined;
    return visible[Math.min(preferredIndex, visible.length - 1)];
  }

  private async requireVisibleLocator(
    locator: Locator,
    message: string,
    preferredIndex = 0
  ): Promise<Locator> {
    const visible = await this.visibleLocator(locator, preferredIndex);
    if (!visible) {
      throw new Error(message);
    }
    return visible;
  }
}
