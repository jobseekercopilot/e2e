import {expect, type Page} from '@playwright/test';
import {BasePage} from './base.page';

type JsonRecord = Record<string, unknown>;

export interface FixtureCheckout {
  orderId: string;
  checkoutSessionId: string;
  url: string;
  status: 'CHECKOUT_OPEN';
  expiresAt: string;
  promotionBonusDocumentCredits: number;
  promotionGuaranteed: boolean;
  consumerTermsVersion: string;
  consumerAcknowledgementsRecorded: boolean;
  pricingSnapshot: JsonRecord;
}

interface ApiResult {
  status: number;
  body: unknown;
}

export class DocumentCreditPaymentPage extends BasePage {
  private checkout?: FixtureCheckout;

  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/payment');
    await expect(this.page.getByRole('heading', {name: /document credits|credits available/i}).first())
      .toBeVisible({timeout: 20_000});
  }

  async assertCatalogAndFreeWallet(): Promise<void> {
    const [catalogResult, walletResult] = await Promise.all([
      this.get('/api/v2/payments/catalog'),
      this.get('/api/v2/payments/wallet'),
    ]);
    expect(catalogResult.status).toBe(200);
    expect(walletResult.status).toBe(200);
    const catalog = record(catalogResult.body, 'catalog');
    const wallet = record(walletResult.body, 'wallet');
    expect(catalog).toMatchObject({
      catalogVersion: 'public-beta-2026-08-22',
      currency: 'GBP',
      billingCountry: 'GB',
      taxStatus: 'NOT_VAT_REGISTERED',
      taxTreatment: 'VAT_NOT_CHARGED',
      displayedPriceIsCheckoutTotal: true,
      automaticRenewal: false,
      creditUnit: 'DOCUMENT',
      freeAllowanceCredits: 2,
    });
    expect(catalog['plans']).toEqual([
      {
        id: 'starter', name: 'Starter',
        description: 'Up to 5 complete CV and cover-letter applications',
        documentCredits: 10, priceMinor: 499, currency: 'GBP',
        fullApplicationEquivalent: 5, promotionBonusDocumentCredits: 5,
        active: true, sortOrder: 1,
      },
      {
        id: 'active', name: 'Active', description: '25 tailored document credits',
        documentCredits: 25, priceMinor: 1199, currency: 'GBP',
        fullApplicationEquivalent: 12, promotionBonusDocumentCredits: 13,
        active: true, sortOrder: 2,
      },
      {
        id: 'power', name: 'Power', description: '60 tailored document credits',
        documentCredits: 60, priceMinor: 1999, currency: 'GBP',
        fullApplicationEquivalent: 30, promotionBonusDocumentCredits: 30,
        active: true, sortOrder: 3,
      },
    ]);
    expect(catalog['promotion']).toEqual({
      id: 'founding-200', enabled: true, status: 'AVAILABLE',
      bonusPercent: 50, customerLimit: 200,
    });
    expect(wallet).toEqual({
      balanceDocumentCredits: 2,
      lifetimePurchasedDocumentCredits: 0,
      lifetimeSpentDocumentCredits: 0,
      lifetimeReversedDocumentCredits: 0,
      reviewDebtDocumentCredits: 0,
      freeAllowanceGranted: true,
      status: 'ACTIVE',
    });

    await expect(this.page.getByRole('heading', {name: '2 credits available'})).toBeVisible();
    await expect(this.page.getByText('£4.99', {exact: true})).toBeVisible();
    await expect(this.page.getByText('£11.99', {exact: true})).toBeVisible();
    await expect(this.page.getByText('£19.99', {exact: true})).toBeVisible();
    await expect(this.page.getByText('One credit means one delivered document')).toBeVisible();
    await expect(this.page.getByText(/No credit is used/).first()).toBeVisible();
  }

  async assertCheckoutAcknowledgements(): Promise<void> {
    const acknowledgement = this.page.getByRole('checkbox');
    await expect(acknowledgement).toBeVisible();
    await expect(acknowledgement).not.toBeChecked();
    await expect(this.page.getByText(/billing address is in the United Kingdom/)).toBeVisible();
    await expect(this.page.getByText(/one-off purchase rather than a subscription/)).toBeVisible();
    await expect(this.page.getByText(/request immediate supply/)).toBeVisible();
    await expect(this.page.getByText(/14-day cancellation right/)).toBeVisible();
  }

  async assertFixtureReadinessFailsClosed(): Promise<void> {
    const readiness = await this.get('/api/v2/payments/checkout-readiness');
    expect(readiness.status).toBe(200);
    expect(readiness.body).toEqual({
      checkoutAvailable: true,
      code: 'READY',
      paymentServiceCode: 'READY',
      providerCode: 'READY',
      mode: 'FIXTURE',
    });
    await expect(this.page.getByText('Purchasing unavailable', {exact: true})).toBeVisible();
    for (const plan of ['Starter', 'Active', 'Power']) {
      await expect(this.page.getByRole('button', {name: `Choose ${plan}`})).toBeDisabled();
    }
  }

  async createStarterCheckout(): Promise<void> {
    await this.open();
    const result = await this.page.evaluate(async () => {
      const csrfResponse = await fetch('/api/auth/csrf', {
        headers: {Accept: 'application/json'},
        credentials: 'same-origin',
      });
      const csrf = await csrfResponse.json() as {headerName?: unknown; token?: unknown};
      if (!csrfResponse.ok
        || csrf.headerName !== 'X-CSRF-Token'
        || typeof csrf.token !== 'string') {
        throw new Error('CSRF bootstrap failed');
      }
      const response = await fetch('/api/v2/payments/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          [csrf.headerName]: csrf.token,
        },
        body: JSON.stringify({
          pricingPlanId: 'starter',
          billingCountry: 'GB',
          immediateSupplyRequested: true,
          cancellationRightLossAcknowledged: true,
        }),
      });
      return {status: response.status, body: await response.json() as unknown};
    });
    expect(result.status).toBe(200);
    const checkout = record(result.body, 'checkout') as unknown as FixtureCheckout;
    expect(checkout).toMatchObject({
      status: 'CHECKOUT_OPEN',
      promotionBonusDocumentCredits: 5,
      promotionGuaranteed: true,
      consumerTermsVersion: 'uk-consumer-terms-2026-08-15',
      consumerAcknowledgementsRecorded: true,
      pricingSnapshot: {
        catalogVersion: 'public-beta-2026-08-22',
        pricingPlanId: 'starter',
        pricingPlanName: 'Starter',
        documentCredits: 10,
        priceMinor: 499,
        currency: 'GBP',
        billingCountry: 'GB',
        taxStatus: 'NOT_VAT_REGISTERED',
        taxTreatment: 'VAT_NOT_CHARGED',
        legalEntityType: 'SOLE_TRADER',
        legalEntityConfigurationVersion: 'e2e-reviewed-fixture-v1',
        displayedPriceIsCheckoutTotal: true,
      },
    });
    expect(checkout.orderId).toMatch(/^[0-9a-f-]{36}$/);
    expect(checkout.checkoutSessionId).toMatch(/^cs_fixture_[a-f0-9]{32}$/);
    expect(checkout.url).toBe(
      `https://checkout.stripe.test/fixture/${checkout.checkoutSessionId}`
    );
    expect(Date.parse(checkout.expiresAt)).toBeGreaterThan(Date.now());
    this.checkout = checkout;
  }

  requireCheckout(): FixtureCheckout {
    if (!this.checkout) throw new Error('Fixture checkout was not created.');
    return this.checkout;
  }

  async visitReturn(kind: 'success' | 'cancel'): Promise<void> {
    const checkout = this.requireCheckout();
    await this.page.goto(`/payment/${kind}?order_id=${checkout.orderId}`);
    await expect(this.page).toHaveURL(new RegExp(`/payment/${kind}$`));
  }

  async assertPendingReturn(): Promise<void> {
    await expect(this.page.getByRole('heading', {name: /Checking payment status|Payment is still processing/}))
      .toBeVisible({timeout: 20_000});
    await expect(this.page.getByRole('heading', {name: 'Payment confirmed'})).toHaveCount(0);
    await expect(this.page.getByText(/credits were added after secure server confirmation/))
      .toHaveCount(0);
    const status = await this.orderStatus();
    expect(status).toMatchObject({
      orderId: this.requireCheckout().orderId,
      status: 'CHECKOUT_OPEN',
      creditsAdded: false,
      totalGrantedDocumentCredits: 0,
      messageCode: 'PAYMENT_PENDING',
    });
  }

  async assertFulfilledReturn(expectedCredits: number): Promise<void> {
    await expect(this.page.getByRole('heading', {name: 'Payment confirmed'}))
      .toBeVisible({timeout: 20_000});
    await expect(this.page.getByText(
      `${expectedCredits} document credits were added after secure server confirmation.`
    )).toBeVisible();
    const status = await this.orderStatus();
    expect(status).toMatchObject({
      orderId: this.requireCheckout().orderId,
      status: 'FULFILLED',
      documentCredits: 10,
      promotionBonusDocumentCredits: 5,
      totalGrantedDocumentCredits: 15,
      creditsAdded: true,
      messageCode: 'CREDITS_ADDED',
    });
  }

  async assertExpiredReturn(): Promise<void> {
    await expect(this.page.getByRole('heading', {name: 'Checkout expired'}))
      .toBeVisible({timeout: 20_000});
    await expect(this.page.getByText(
      'The secure checkout expired before payment was confirmed. No document credits were added for this order.'
    )).toBeVisible();
    const status = await this.orderStatus();
    expect(status).toMatchObject({
      orderId: this.requireCheckout().orderId,
      status: 'EXPIRED',
      totalGrantedDocumentCredits: 0,
      creditsAdded: false,
      messageCode: 'CHECKOUT_EXPIRED',
    });
  }

  async assertFulfilledLedger(): Promise<void> {
    const wallet = record((await this.get('/api/v2/payments/wallet')).body, 'wallet');
    expect(wallet).toMatchObject({
      balanceDocumentCredits: 17,
      lifetimePurchasedDocumentCredits: 15,
      lifetimeSpentDocumentCredits: 0,
      lifetimeReversedDocumentCredits: 0,
      freeAllowanceGranted: true,
      status: 'ACTIVE',
    });
    const transactions = await this.transactions();
    expect(transactions).toHaveLength(3);
    expect(transactions.map(transaction => transaction['type']).sort()).toEqual([
      'FREE_ALLOWANCE_GRANTED', 'PROMOTION_BONUS', 'PURCHASE',
    ]);
    expect(transactions.filter(transaction => transaction['type'] === 'PURCHASE')).toHaveLength(1);
    expect(transactions.filter(transaction => transaction['type'] === 'PROMOTION_BONUS')).toHaveLength(1);

    await this.page.goto('/payment/history');
    const table = this.page.getByRole('table', {name: 'Document-credit history'});
    await expect(table).toBeVisible({timeout: 20_000});
    await expect(table.getByRole('row')).toHaveCount(4);
    await this.assertHistoryRow('Free document credits granted', '+2 credits', '2 credits');
    await this.assertHistoryRow('Starter document credits purchased', '+10 credits', '12 credits');
    await this.assertHistoryRow('Founding customer bonus credits granted', '+5 credits', '17 credits');
  }

  async assertFreeOnlyLedger(): Promise<void> {
    const wallet = record((await this.get('/api/v2/payments/wallet')).body, 'wallet');
    expect(wallet).toMatchObject({
      balanceDocumentCredits: 2,
      lifetimePurchasedDocumentCredits: 0,
      lifetimeSpentDocumentCredits: 0,
      lifetimeReversedDocumentCredits: 0,
      freeAllowanceGranted: true,
      status: 'ACTIVE',
    });
    const transactions = await this.transactions();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      type: 'FREE_ALLOWANCE_GRANTED',
      documentCredits: 2,
      balanceBeforeDocumentCredits: 0,
      balanceAfterDocumentCredits: 2,
    });

    await this.page.goto('/payment/history');
    const table = this.page.getByRole('table', {name: 'Document-credit history'});
    await expect(table).toBeVisible({timeout: 20_000});
    await expect(table.getByRole('row')).toHaveCount(2);
    await this.assertHistoryRow('Free document credits granted', '+2 credits', '2 credits');
    await expect(table.getByText(/purchased|bonus/i)).toHaveCount(0);
  }

  private async assertHistoryRow(
    activity: string,
    change: string,
    balanceAfter: string
  ): Promise<void> {
    const row = this.page.getByRole('row').filter({hasText: activity});
    await expect(row).toHaveCount(1);
    const cells = row.getByRole('cell');
    await expect(cells).toHaveCount(4);
    await expect(cells.nth(1)).toHaveText(activity);
    await expect(cells.nth(2)).toHaveText(change);
    await expect(cells.nth(3)).toHaveText(balanceAfter);
  }

  private async orderStatus(): Promise<JsonRecord> {
    const result = await this.get(
      `/api/v2/payments/orders/${this.requireCheckout().orderId}/status`
    );
    expect(result.status).toBe(200);
    return record(result.body, 'order status');
  }

  private async transactions(): Promise<JsonRecord[]> {
    const result = await this.get('/api/v2/payments/transactions?limit=20');
    expect(result.status).toBe(200);
    const body = record(result.body, 'transactions');
    if (!Array.isArray(body['transactions'])
      || !body['transactions'].every(item => item !== null
        && typeof item === 'object' && !Array.isArray(item))) {
      throw new Error('Transactions response was invalid.');
    }
    return body['transactions'] as JsonRecord[];
  }

  private get(path: string): Promise<ApiResult> {
    return this.page.evaluate(async requestPath => {
      const response = await fetch(requestPath, {
        headers: {Accept: 'application/json'},
        credentials: 'same-origin',
      });
      return {status: response.status, body: await response.json() as unknown};
    }, path);
  }
}

function record(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`The ${label} response was not an object.`);
  }
  return value as JsonRecord;
}
