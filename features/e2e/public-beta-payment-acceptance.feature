@e2e @stack @core-regression @payment-acceptance
Feature: Public-beta document-generation checkout remains server-authoritative

  @state:PAYMENT_ACCEPTANCE @critical-smoke
  Scenario: Pricing, free allowance and fixture readiness remain truthful
    Given the payment acceptance account is signed in
    When the owner opens document-generation pricing
    Then the exact server-owned document-generation catalogue and free allowance are shown
    And checkout acknowledgements are disclosed before purchase
    And fixture readiness cannot be mistaken for a live payment provider

  @state:PAYMENT_ACCEPTANCE @critical-smoke
  Scenario: Signed settlement fulfils one checkout exactly once
    Given the payment acceptance account is signed in
    When the owner creates an acknowledged Starter fixture checkout
    Then the return link alone still reports the order as pending
    When the signed completed provider event is delivered twice
    Then the owner return page confirms exactly 15 generations were added
    And the wallet and history record that purchase and bonus exactly once

  @state:PAYMENT_ACCEPTANCE @critical-smoke
  Scenario: Signed expiry leaves the balance and history unchanged
    Given the payment acceptance account is signed in
    When the owner creates an acknowledged Starter fixture checkout
    And the owner visits the cancellation return before provider reconciliation
    Then the return link does not claim payment or generations
    When the signed expired provider event is delivered twice
    Then the owner return page confirms checkout expiry with no generations added
    And the wallet and history contain only the free allowance

  @state:PAYMENT_ACCEPTANCE @critical-smoke
  Scenario: A late signed completion reconciles safely from the cancellation return
    Given the payment acceptance account is signed in
    When the owner creates an acknowledged Starter fixture checkout
    And the owner visits the cancellation return before provider reconciliation
    Then the return link does not claim payment or generations
    When the signed completed provider event is delivered twice
    Then the owner return page confirms exactly 15 generations were added
    And the wallet and history record that purchase and bonus exactly once
