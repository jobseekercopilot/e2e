Feature: Full marketing trailer journey

  Scenario: Alex uses Job Seeker Copilot from registration to offer
    Given Alex Taylor is a new job seeker
    When he opens Job Seeker Copilot
    And he registers an account
    And he completes his job seeker profile
    Then he should arrive on the dashboard
    When he opens the job search workspace
    And he searches for software developer jobs
    And he opens a relevant software developer job
    Then the job details should be visible
    When Alex generates application documents
    Then a tailored CV should be created
    And a tailored cover letter should be created
    And both documents should be available to download
    When he views generated documents if demo data exists
    And he previews and downloads stored documents if available
    And he opens the application tracker
    And he marks an application as offer if available
    Then the activity timeline should be visible if demo data exists
    And the promo shot pauses at the final trailer state
