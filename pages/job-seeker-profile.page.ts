import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';
import type { DemoUser } from '../support/world';
import type { ProfessionalContactFixture } from '../support/beta-trust-fixtures';

export class JobSeekerProfilePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async confirmProfileCompleted(user: DemoUser): Promise<void> {
    await expect(this.byTestId('job-search-preferences')).toBeVisible();
    await expect(this.page.getByRole('heading', { name: user.fullName })).toBeVisible();
    await expect(this.page.getByText(user.email)).toBeVisible();
  }

  async updateHomeLocation(postcode: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Edit Location and commute', exact: true }).click();
    const input = this.page.getByLabel('Town or postcode', { exact: true });
    await input.fill(postcode);
    const suggestions = this.page.getByRole('listbox', { name: 'Matching UK locations' });
    await expect(suggestions).toBeVisible();
    await suggestions.getByRole('option').first().click();
    await expect(this.page.getByText('Confirming location…')).toBeHidden();
    await this.page.getByRole('button', { name: 'Save this section', exact: true }).click();
    await expect(this.page.getByRole('button', { name: 'Save this section', exact: true })).toBeHidden();
  }

  async expectHomeLocation(location: string): Promise<void> {
    await expect(this.page.getByText(location, { exact: false })).toBeVisible();
  }

  async completeJobSearchPreferences(): Promise<void> {
    const profile = this.page.locator('#left-sidebar');

    await profile.getByRole('button', { name: 'Edit Working preferences', exact: true }).click();
    const workingPreferences = profile.locator('#profile-working-preferences-editor');
    const hybrid = workingPreferences.getByLabel('Hybrid', { exact: true });
    if (!(await hybrid.isChecked())) await hybrid.check();
    const fullTime = workingPreferences.getByLabel('Full time', { exact: true });
    if (!(await fullTime.isChecked())) await fullTime.check();
    await this.saveProfileSection(profile);

    await profile.getByRole('button', { name: 'Edit Availability', exact: true }).click();
    const availability = profile.locator('#profile-availability-editor');
    await availability.getByLabel('Or notice period in days', { exact: true }).fill('14');
    await this.saveProfileSection(profile);

    await expect(
      profile.getByRole('heading', { name: 'Availability', exact: true }).locator('..')
    ).toContainText("14 days' notice");
  }

  async saveProfessionalContact(contact: ProfessionalContactFixture): Promise<void> {
    const profile = this.page.locator('#left-sidebar');
    const section = profile.getByTestId('profile-professional-contact');
    await section.getByRole('button', {name: 'Edit professional contact', exact: true}).click();
    await section.getByLabel('Professional phone number', {exact: true}).fill(contact.phone);

    const removeLinks = section.locator('.contact-link-remove');
    while (await removeLinks.count() > 0) await removeLinks.first().click();
    for (let index = 0; index < contact.links.length; index += 1) {
      await section.getByRole('button', {name: 'Add professional link', exact: true}).click();
      await section.getByLabel(`Link ${index + 1} label`, {exact: true})
        .fill(contact.links[index].label);
      await section.getByLabel(`Link ${index + 1} HTTPS address`, {exact: true})
        .fill(contact.links[index].url);
    }

    const saved = this.page.waitForResponse(response =>
      response.request().method() === 'PATCH'
      && new URL(response.url()).pathname === '/api/auth/profile/professional-contact');
    await profile.getByRole('button', {name: 'Save this section', exact: true}).click();
    const response = await saved;
    expect(response.ok(), `professional-contact update failed with HTTP ${response.status()}`)
      .toBe(true);
    expect(response.request().postDataJSON()).toEqual(contact);
    expect(response.request().headers()['if-match']).toMatch(/^"?\d+"?$/);
    await expect(section).toContainText(contact.phone);
    for (const link of contact.links) {
      await expect(section.getByRole('link', {name: link.url, exact: true}))
        .toHaveAttribute('href', link.url);
    }
  }

  private async saveProfileSection(profile: Locator): Promise<void> {
    const responsePromise = this.page.waitForResponse(response =>
      response.request().method() === 'PATCH'
      && new URL(response.url()).pathname === '/api/auth/profile'
    );
    await profile.getByRole('button', { name: 'Save this section', exact: true }).click();
    const response = await responsePromise;
    expect(response.ok(), `profile update failed with HTTP ${response.status()}`).toBeTruthy();
    await expect(
      profile.getByRole('button', { name: 'Save this section', exact: true })
    ).toHaveCount(0);
  }
}
