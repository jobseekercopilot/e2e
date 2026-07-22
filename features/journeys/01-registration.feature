@demo
Feature: Registration promo clip

  Scenario: Alex Taylor registers and reaches the dashboard
    Given Alex Taylor is a new job seeker
    When he opens Job Seeker Copilot
    And he registers an account
    And he completes his job seeker profile
    Then he should arrive on the dashboard
    And the promo shot pauses on the dashboard
