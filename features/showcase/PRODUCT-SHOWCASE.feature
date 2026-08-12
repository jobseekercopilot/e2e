@demo @promo @showcase @state:REGISTRATION_CLEAN
Feature: Job Seeker Copilot product showcase

  Scenario: Alex moves from a new account to a tailored application pack
    Given the showcase candidate is ready to register
    And the showcase chapter "ONBOARDING" begins
    When he opens Job Seeker Copilot
    And he registers an account
    Then he should arrive on the dashboard

    When the showcase chapter "PROFILE" begins
    And Alex builds a rich professional profile and evidence library

    When the showcase chapter "DISCOVER" begins
    And Alex discovers the selected showcase job

    When the showcase chapter "GENERATE" begins
    And Alex generates a CV and cover letter for the same showcase job
    Then the tailored application documents are ready

    When the showcase chapter "DOCUMENTS" begins
    And Alex reviews and previews both generated documents

    When the showcase chapter "TRACKING" begins
    And Alex reviews the prepared application without marking it as applied

    When the showcase chapter "REPORTING" begins
    Then Alex sees meaningful job-search reporting

    When the showcase chapter "CONNECTED_WORKFLOW" begins
    Then Alex returns to the same selected job

    When the showcase chapter "RETURNING_USER" begins
    And Alex signs out and signs back in
    Then Alex's profile, documents, application and reporting state persist
    And the showcase chapter "END" begins
