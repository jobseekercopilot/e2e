@e2e @stack @core-regression
Feature: Beta trust surfaces remain truthful across the fixture-backed stack

  @state:DEMO_READY @critical-smoke
  Scenario: Professional contact appears only in the approved application document
    Given the primary named-state user is signed in
    When the owner saves synthetic professional contact details
    And the owner starts the Generate application document journey
    And the owner chooses Generate for the CV and Not now for the cover letter
    Then the selected application generation completes
    And the saved application contains the exact selected document references
    And the approved CV download shows the exact professional contact in its header
    And the browser generation command contains no professional contact

  @state:DEMO_READY @critical-smoke
  Scenario: Profile matching and provider provenance degrade without invented confidence
    Given the primary named-state user is signed in
    When the owner searches with the confirmed named-state profile
    Then the response and card show deterministic profile matching and provider provenance
    And query-only and unavailable fixture projections remain truthfully labelled

  @state:DEMO_READY @critical-smoke
  Scenario: Recovery-summary contract projection explains fallback and same-operation reconciliation
    Given the primary named-state user is signed in
    When the owner starts the Generate application document journey
    And the owner chooses Generate for the CV and Generate for the cover letter
    Then real fixture generation completes under the bounded recovery-summary contract projection
    And the saved application contains the exact selected document references
