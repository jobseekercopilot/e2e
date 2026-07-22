import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';
import { e2eConfig } from '../support/config';
import type { DemoUser } from '../support/world';

export class RegisterPage extends BasePage {
  constructor(page: Page, private readonly baseUrl: string) {
    super(page);
  }

  async open(): Promise<void> {
    await this.page.goto(this.baseUrl);
    await expect(this.page).toHaveURL(/\/dashboard|\/$/);
    await this.page.addStyleTag({
      content: 'html, body, * { overflow-anchor: none !important; }'
    });
    await this.page.waitForTimeout(e2eConfig.demoBufferMs);
  }

  async registerUser(user: DemoUser): Promise<void> {
    await this.startCreateProfile();
    await this.enterAccountDetails(user);
    await this.enterProfessionalBackground(user);
    await this.enterJobSearchPreferences(user);
    await this.submitRegistration();
  }

  async loginUser(user: DemoUser): Promise<void> {
    await this.page.goto(this.baseUrl);
    await this.page.addStyleTag({
      content: 'html, body, * { overflow-anchor: none !important; }'
    });
    await this.clickFramed(
      this.byTestId('sign-in-tab')
        .or(this.page.locator('#tab-btn-signin'))
        .or(this.page.getByRole('button', { name: /sign in/i }))
    );
    await this.humanFillInPlace(this.page.getByLabel(/email address/i), user.email);
    await this.humanFillInPlace(this.page.getByLabel(/^password$/i), user.password);
    await this.clickCentered(
      this.byTestId('submit-sign-in-button')
        .or(this.page.locator('#btn-submit-signin'))
        .first()
    );
  }

  private async startCreateProfile(): Promise<void> {
    // TODO frontend: add data-testid="create-profile-tab" to the Create Profile tab.
    const createProfileTab = this.byTestId('create-profile-tab').or(this.page.getByRole('button', { name: /create profile/i }));
    await this.clickFramed(createProfileTab);
  }

  private async enterAccountDetails(user: DemoUser): Promise<void> {
    // TODO frontend: add data-testid values for reg-name, reg-email, reg-password and register-next-button.
    await this.humanFillFramed(this.page.getByLabel(/full name/i), user.fullName);
    await this.humanFillFramed(this.page.getByLabel(/contact email address/i), user.email);
    await this.humanFillFramed(this.page.getByLabel(/^password$/i), user.password);
    await this.clickNextStep();
  }

  private async enterProfessionalBackground(user: DemoUser): Promise<void> {
    await this.addTags('Core Skills', user.skills);
    await this.addTags(/Target Roles/i, user.targetRoles);
    await this.selectWeeklyHours(user.weeklyHours);
    await this.addQualification(user);
    await this.addWorkHistory(user);
    await this.clickNextStep();
  }

  private async enterJobSearchPreferences(user: DemoUser): Promise<void> {
    // TODO frontend: add data-testid="registration-home-location-input" to the home location field.
    await this.humanFillFramed(this.page.getByLabel(/home location/i), user.homeLocation);
    await this.page.keyboard.press('Tab');

    // TODO frontend: make commute options match fixture wording or add data-testid="registration-commute-select".
    const miles = user.commuteRange.match(/\d+/)?.[0] ?? '10';
    await this.selectFramed(this.page.getByLabel(/commute range/i), miles);
  }

  private async submitRegistration(): Promise<void> {
    // TODO frontend: add data-testid="submit-registration-button" to the final create profile button.
    await this.clickFramed(
      this.byTestId('submit-registration-button')
        .or(this.page.locator('#btn-submit-signup'))
    );
  }

  private async clickNextStep(): Promise<void> {
    // TODO frontend: add data-testid="register-next-button" to the Next Step button.
    await this.clickFramed(
      this.byTestId('register-next-button')
        .or(this.page.getByRole('button', { name: /next step/i }))
    );
  }

  private async addTags(label: string | RegExp, values: string[]): Promise<void> {
    const input = this.page.getByLabel(label);

    for (const value of values) {
      await this.humanTypeFramed(input, value);
      await input.press('Enter');
    }
  }

  private async selectWeeklyHours(weeklyHours: string): Promise<void> {
    const weeklyHoursSelect = this.page.getByLabel(/target weekly hours/i);
    await this.selectFramed(weeklyHoursSelect, { label: weeklyHours }).catch(async () => {
      await this.selectFramed(weeklyHoursSelect, 'FULL_TIME');
    });
  }

  private async addQualification(user: DemoUser): Promise<void> {
    // TODO frontend: add data-testid="add-qualification-button" and "save-qualification-button" in app-qualification-form.
    await this.clickFramed(this.page.getByRole('button', { name: /add qualification/i }));
    await this.humanFillFramed(this.page.getByLabel(/qualification name/i), user.qualification.name);
    await this.humanFillFramed(this.page.getByLabel(/issuing body/i), user.qualification.institution);
    await this.humanFillFramed(this.page.getByLabel(/grade/i), user.qualification.grade);
    await this.fillFramed(this.page.getByLabel(/date achieved/i), `${user.qualification.completed}-06`);
    await this.clickFramed(this.page.getByRole('button', { name: /^add$/i }));
  }

  private async addWorkHistory(user: DemoUser): Promise<void> {
    // TODO frontend: add data-testid values for add/save role buttons so this remains stable as icons/styles change.
    await this.intentionalScrollNearCenter(this.page.getByRole('button', { name: /add work history/i }));

    for (const role of user.workHistory) {
      await this.clickFramed(this.page.getByRole('button', { name: /add work history/i }));
      await this.scrollToPageBottom();
      await expect(this.page.getByLabel(/job title/i)).toBeVisible();
      await this.humanFillFramed(this.page.getByLabel(/job title/i), role.jobTitle);
      await this.humanFillFramed(this.page.getByLabel(/employer/i), role.employer);

      if (/present/i.test(role.to)) {
        await this.selectFramed(this.page.getByLabel(/status/i), 'CURRENT');
      } else {
        await this.selectFramed(this.page.getByLabel(/status/i), 'PREVIOUS_ROLE');
      }

      await this.fillFramed(this.page.getByLabel(/start date/i), this.toMonthValue(role.from));

      if (!/present/i.test(role.to)) {
        await this.fillFramed(this.page.getByLabel(/end date/i), this.toMonthValue(role.to));
      }

      await this.humanFillFramed(this.page.getByLabel(/key responsibilities/i), role.description);
      await this.clickFramed(this.page.getByRole('button', { name: /^add$/i }));
      await this.page.waitForTimeout(300);
    }
  }

  private toMonthValue(displayDate: string): string {
    const parsed = new Date(`${displayDate} 1`);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Unable to convert fixture date "${displayDate}" into an input[type=month] value.`);
    }

    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }
}
