@e2e @reporting @core-regression
Feature: Reporting reconciles exact persisted application history

  @state:CROSS_USER_SECURITY
  Scenario: Empty user reporting is exactly zero
    Given the first cross-user identity is signed in
    Then reporting reconciles exactly 0 source applications through the API and UI

  @state:CROSS_USER_SECURITY
  Scenario: Small user reporting follows two browser-created applications
    Given the first cross-user identity is signed in
    When the user creates 2 saved applications without documents
    Then reporting reconciles exactly 2 source applications through the API and UI

  @state:DEMO_READY
  Scenario: Rich history reporting follows the governed nine-application dataset
    Given the primary named-state user is signed in
    Then reporting reconciles exactly 9 source applications through the API and UI
