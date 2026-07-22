import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class AiCreditPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.page.goto('/payment');
    await expect(this.page.getByRole('heading', { name: /AI Credit|£/i }).first()).toBeVisible({ timeout: 20_000 });
    await this.intentionalScrollNearCenter(this.page.getByText(/Core job search features are free|Free starter AI Credit|Demo purchase/i).first());
  }

  async waitForBalance(): Promise<void> {
    // TODO frontend: add data-testid="ai-credit-balance".
    await expect(this.byTestId('ai-credit-balance').or(this.page.getByText(/AI Credit|Remaining|Spent/i).first())).toBeVisible();
  }

  async waitForSpendingLog(): Promise<boolean> {
    await this.page.goto('/payment/history');
    const log = this.byTestId('spending-log').or(this.page.getByText(/Spending Log|Demo AI Credit purchase|Demo purchase|usage|spent/i).first());
    const visible = await log.first().isVisible().catch(() => false);
    if (visible) {
      await this.intentionalScrollNearCenter(log.first());
    }
    return visible;
  }

  async assertCheckoutNotStarted(): Promise<void> {
    await expect(this.page).not.toHaveURL(/stripe|checkout/i);
  }

  async addDemoCredit(): Promise<void> {
    const purchaseButtons = this.page.getByRole('button', { name: /^Demo purchase$/i });
    await expect(purchaseButtons.first()).toBeVisible({ timeout: 20_000 });
    await this.clickCentered(purchaseButtons.first());
    await expect(this.page.getByText(/demo purchase added|AI Credit data is unavailable/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByText(/demo purchase added/i).first()).toBeVisible({ timeout: 20_000 });
    await this.page.waitForTimeout(1000);
  }
}
