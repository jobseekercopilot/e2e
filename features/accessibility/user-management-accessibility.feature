@accessibility
Feature: Accessible and resilient user-management journey

  @framework
  Scenario: Accessibility automation is fail-closed in CI
    Then the accessibility execution profile is fail-closed

  @state:REGISTRATION_CLEAN
  Scenario: A claimant completes onboarding with keyboard and accessible feedback
    Given the named-state user "registration-primary" is ready to register
    When he opens Job Seeker Copilot
    Then the current beta page has no automated accessibility violations
    When he attempts to continue registration using only the keyboard
    Then registration validation focus moves to the error summary
    When he completes registration using only the keyboard
    Then only one registration request was sent
    And the claimant profile for the named-state user is visible
    And the current beta page has no automated accessibility violations

  @state:LOGIN_SESSION
  Scenario: Profile location failure remains understandable and duplicate-safe
    Given the named-state user "login-primary" has an account
    When he opens Job Seeker Copilot
    And he signs in with the named-state account
    Then the current beta page has no automated accessibility violations
    When he edits his profile while location search is unavailable
    Then loading and safe unavailable location feedback are announced
    And the current beta page has no automated accessibility violations
    When he saves the profile twice in rapid succession
    Then only one profile update request was sent
