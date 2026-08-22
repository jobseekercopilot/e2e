@e2e @personas @core-regression
Feature: Governed personas preserve profile evidence through truthful browser outcomes

  @state:REAL_WORLD_PERSONAS
  Scenario: Seven distinct profiles survive reload and follow explicit fixture-backed outcomes
    Then all seven governed personas complete their supported browser journeys
