Feature: Dashboard reveal promo clip

  Scenario: Alex Taylor views his dashboard
    Given Alex Taylor is logged in
    When he opens the dashboard workspace
    Then the dashboard should be visible and populated
    And the promo shot pauses on the dashboard
