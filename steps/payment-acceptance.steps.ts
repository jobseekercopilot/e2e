import {Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {PUBLIC_NAMED_STATE_PASSWORD, alexTaylorDemoUser} from '../support/demo-data';
import type {JobSeekerWorld} from '../support/world';

Given('the payment acceptance account is signed in', async function (this: JobSeekerWorld) {
  const identity = this.namedStateDefinition?.identities.find(
    candidate => candidate.key === 'payment-primary'
  );
  if (!identity || !this.registerPage || !this.dashboardPage) {
    throw new Error('The PAYMENT_ACCEPTANCE identity or login page is unavailable.');
  }
  const user = {
    ...alexTaylorDemoUser(),
    fullName: identity.displayName,
    email: identity.email,
    password: PUBLIC_NAMED_STATE_PASSWORD,
  };
  this.demoUser = user;
  await this.registerPage.loginUser(user);
  await this.dashboardPage.waitForDashboard();
});

When('the owner opens document-credit pricing', async function (this: JobSeekerWorld) {
  await requiredPage(this).open();
});

Then('the exact server-owned document-credit catalogue and free balance are shown', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).assertCatalogAndFreeWallet();
});

Then('checkout acknowledgements are disclosed before purchase', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).assertCheckoutAcknowledgements();
});

Then('fixture readiness cannot be mistaken for a live payment provider', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).assertFixtureReadinessFailsClosed();
});

When('the owner creates an acknowledged Starter fixture checkout', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).createStarterCheckout();
});

Then('the return link alone still reports the order as pending', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).visitReturn('success');
  await requiredPage(this).assertPendingReturn();
});

When('the signed completed provider event is delivered twice', async function (
  this: JobSeekerWorld
) {
  const checkout = requiredPage(this).requireCheckout();
  if (!this.systemDataClient) throw new Error('System Data client is unavailable.');
  const first = await this.systemDataClient.paymentEvent(checkout.checkoutSessionId, 'COMPLETED');
  const replay = await this.systemDataClient.paymentEvent(checkout.checkoutSessionId, 'COMPLETED');
  expect(replay.providerEventId).toBe(first.providerEventId);
  expect(replay.orderId).toBe(checkout.orderId);
});

Then('the owner return page confirms exactly 15 credits were added', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).assertFulfilledReturn(15);
});

Then('the wallet and history record that purchase and bonus exactly once', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).assertFulfilledLedger();
});

When('the owner visits the cancellation return before provider reconciliation', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).visitReturn('cancel');
});

Then('the return link does not claim payment or credits', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).assertPendingReturn();
});

When('the signed expired provider event is delivered twice', async function (
  this: JobSeekerWorld
) {
  const checkout = requiredPage(this).requireCheckout();
  if (!this.systemDataClient) throw new Error('System Data client is unavailable.');
  const first = await this.systemDataClient.paymentEvent(checkout.checkoutSessionId, 'EXPIRED');
  const replay = await this.systemDataClient.paymentEvent(checkout.checkoutSessionId, 'EXPIRED');
  expect(replay.providerEventId).toBe(first.providerEventId);
  expect(replay.orderId).toBe(checkout.orderId);
});

Then('the owner return page confirms checkout expiry with no credits added', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).assertExpiredReturn();
});

Then('the wallet and history contain only the free allowance', async function (
  this: JobSeekerWorld
) {
  await requiredPage(this).assertFreeOnlyLedger();
});

function requiredPage(world: JobSeekerWorld) {
  if (!world.documentCreditPaymentPage) {
    throw new Error('Document-credit payment page was not initialised.');
  }
  return world.documentCreditPaymentPage;
}
