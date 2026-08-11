@e2e @personas @core-regression
Feature: Every governed persona remains usable in the real browser product

  @state:REAL_WORLD_PERSONAS
  Scenario: Seven distinct profiles survive reload, search, matching, documents and generation
    Then all seven governed personas complete their supported browser journeys
