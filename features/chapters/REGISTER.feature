Feature: REGISTER

  Scenario: Alex creates his Job Seeker Copilot workspace
    Given Alex Taylor is a new job seeker
    When he opens Job Seeker Copilot
    And he registers an account
    And he completes his job seeker profile
    Then he should arrive on the dashboard
    And the promo shot pauses on the dashboard
