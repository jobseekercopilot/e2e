@e2e @mobile-product @release-review
Feature: The complete customer product remains usable on touch-sized screens

  @state:REAL_WORLD_PERSONAS
  Scenario: Five governed personas complete the highest-value mobile journey
    Then five governed personas complete phone journeys

  @state:REAL_WORLD_PERSONAS @mobile-tablet
  Scenario: The typical persona completes the tablet layout audit
    Then a governed persona completes the tablet layout audit

  @state:REAL_WORLD_PERSONAS @desktop-product
  Scenario: The typical persona completes the desktop visual audit
    Then a governed persona completes the desktop visual audit
