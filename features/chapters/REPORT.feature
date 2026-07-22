Feature: REPORT

  Scenario: Alex reviews evidence of job-search activity
    Given Alex Taylor is logged in
    When he opens the dashboard workspace
    Then the activity timeline should be visible if demo data exists
    And the promo shot pauses on the activity timeline
