@e2e
Feature: NHS Jobs authoritative source evidence

  @state:REGISTRATION_CLEAN
  Scenario: An NHS vacancy keeps its authoritative source through tracking and reporting
    Given the named-state user "registration-primary" is ready to register
    And the job seeker targets NHS community nursing roles
    When he opens Job Seeker Copilot
    And he registers an account
    Then the claimant profile for the named-state user is visible
    When he opens the job search workspace
    Then the strict NHS fixture result is visible with attribution and safe links
    When he adds the NHS vacancy to My Applications
    Then the saved NHS source metadata is returned by Application Tracking
    When he reloads and opens the NHS application
    Then the authoritative NHS source is still visible and unchanged
    When he opens Reporting evidence
    Then NHS source evidence is present in the activity and UC journal
    And the downloaded evidence preserves the NHS vacancy source
