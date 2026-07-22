Feature: Demo trailer journey

  Scenario: A job seeker creates a workspace and begins an application journey
    Given Alex Taylor is a new job seeker
    When he opens Job Seeker Copilot
    And he registers an account
    And he completes his job seeker profile
    Then he should arrive on the dashboard
