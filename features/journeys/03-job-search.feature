Feature: Job search promo clip

  Scenario: Alex searches for software developer jobs
    Given Alex Taylor is logged in
    When he opens the job search workspace
    And he searches for software developer jobs
    Then relevant job results should be visible
    And the promo shot scrolls through job results
