@smoke @stack @critical-smoke @core-regression
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

  @state:LOGIN_SESSION
  Scenario: An authenticated claimant signs out and cannot reuse the protected session
    Given the named-state user "login-primary" has an account
    When he opens Job Seeker Copilot
    And he signs in with the named-state account
    And he signs out of the claimant session
    Then the protected workspace remains unavailable

  @state:PROFILE_LOCATION
  Scenario: A claimant updates a profile with fixture-backed postcode metadata
    Given the named-state user "profile-primary" has an account
    When he opens Job Seeker Copilot
    And he signs in with the named-state account
    And he updates his home location to "RG1 1AA"
    Then the canonical home location "Reading, South East (RG1 1AA)" is visible

  @state:PROFILE_LOCATION
  Scenario: Specialist NHS and apprenticeship vacancies are presented end to end
    Given the named-state user "profile-primary" has an account
    When he opens Job Seeker Copilot
    And he signs in with the named-state account
    And he completes the remaining job search preferences
    And he opens the job search workspace
    Then NHS and apprenticeship vacancies should be visible
    And apprenticeship training and location details should be preserved
    When he starts both specialist vacancies as applications
    And he opens the application tracker
    Then both specialist applications should be visible
