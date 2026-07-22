Feature: DISCOVER

  Scenario: Alex discovers relevant software developer roles
    Given Alex Taylor is logged in
    When he opens the job search workspace
    And he searches for software developer jobs
    Then relevant job results should be visible
    And the promo shot scrolls through job results
    When he opens a relevant software developer job
    Then the job details should be visible
    And document generation actions should be visible if available
