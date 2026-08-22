@demo
Feature: Dashboard activity promo clip

  Scenario: Alex returns to the dashboard after taking actions
    Given Alex Taylor is logged in
    When he opens the dashboard workspace
    Then the activity timeline should be visible if demo data exists
    And the promo shot pauses on the activity timeline
