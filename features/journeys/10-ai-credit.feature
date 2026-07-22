@demo
Feature: AI credit promo clip

  Scenario: Alex adds demo AI credit and views usage
    Given Alex Taylor is logged in
    When he opens the AI credit workspace
    And he adds demo AI credit
    Then AI credit balance or spending log should be visible
    And no real payment is started
