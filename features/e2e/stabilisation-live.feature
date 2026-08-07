@e2e @stack @stabilisation @state:DEMO_READY
Feature: Profile, evidence, real-provider search and document generation stabilisation

  The checkpoint uses the isolated DEMO_READY identity. Real job providers are
  mandatory, and scenarios that can spend OpenAI credit are separately gated.

  @stabilisation-ui
  Scenario: The compact profile and in-card preparation journey remain usable
    Given the isolated DEMO_READY job seeker is signed in
    Then the profile uses professional section labels
    And Experience and achievements is a compact profile summary
    When the advanced Experience and achievements manager is opened
    And a minimal Employment is created and confirmed
    And a minimal Project is created and confirmed
    And a minimal Qualification is created and confirmed
    Then the confirmed evidence is reflected in the compact profile summary
    When the profile is configured for two broad target roles
    Then both target roles have independent real-provider results and page state
    And a provider job description expands and collapses safely
    When an unsaved job is saved and its evidence selector is previewed
    Then document preparation remains attached to that selected job

  @stabilisation-stale
  Scenario: A stale profile revision is rejected across two signed-in sessions
    Given the isolated DEMO_READY job seeker is signed in
    When two browser sessions submit different profile revisions
    Then the stale session receives the actionable conflict state

  @stabilisation-live
  Scenario: Five full live journeys succeed consecutively and persist after reload
    Given the isolated DEMO_READY job seeker is signed in
    And focused Project and Qualification evidence is confirmed
    And the profile is configured for two broad target roles
    And the runtime exposes real providers and real OpenAI generation
    When five distinct application and document journeys run consecutively
    Then all five isolated live journeys have completed

  @stabilisation-probe
  Scenario: One separately authorised generation completes the persisted document journey
    Given the isolated DEMO_READY job seeker is signed in
    And focused Project and Qualification evidence is confirmed
    And the profile is configured for two broad target roles
    And the runtime exposes real providers and real OpenAI generation
    When one separately authorised generation probe completes
    Then exactly one probe operation and completed job are recorded

  @stabilisation-cancellation
  Scenario: A cancelled live generation preserves its evidence selection
    Given the isolated DEMO_READY job seeker is signed in
    And focused Project and Qualification evidence is confirmed
    And the profile is configured for two broad target roles
    When one explicitly authorised live generation is cancelled
    Then its evidence selection is available for a safe retry
