@demo
Feature: Job details promo clip

  Scenario: Alex opens a software developer job
    Given Alex Taylor is logged in
    When he opens the job search workspace
    And he searches for software developer jobs
    And he opens a relevant software developer job
    Then the job details should be visible
    And document generation actions should be visible if available
