@smoke @stack
Feature: Full application session and profile smoke

  @state:REGISTRATION_CLEAN
  Scenario: A new claimant registers with a deterministic location
    Given the named-state user "registration-primary" is ready to register
    When he opens Job Seeker Copilot
    And he registers an account
    Then the claimant profile for the named-state user is visible
    And the canonical home location "Reading, South East (RG1 1AA)" is visible

  @state:LOGIN_SESSION
  Scenario: An existing claimant signs in through the browser session boundary
    Given the named-state user "login-primary" has an account
    When he opens Job Seeker Copilot
    And he signs in with the named-state account
    Then the claimant profile for the named-state user is visible

  @state:PROFILE_LOCATION
  Scenario: A claimant updates a profile with fixture-backed postcode metadata
    Given the named-state user "profile-primary" has an account
    When he opens Job Seeker Copilot
    And he signs in with the named-state account
    And he updates his home location to "RG1 1AA"
    Then the canonical home location "Reading, South East (RG1 1AA)" is visible

  @state:LOGIN_SESSION
  Scenario: Specialist NHS and apprenticeship vacancies are presented end to end
    Given the named-state user "login-primary" has an account
    When he opens Job Seeker Copilot
    And he signs in with the named-state account
    And he opens the job search workspace
    Then NHS and apprenticeship vacancies should be visible
    And apprenticeship training and location details should be preserved
