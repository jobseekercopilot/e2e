@e2e @application-documents
Feature: Uploaded and generated documents remain explicit application choices

  Background:
    Given the primary named-state user is signed in

  @state:CROSS_USER_SECURITY
  Scenario Outline: Add a saved application with independent upload choices
    When the user starts the Add application document journey
    And the user chooses <cv> for the CV and <cover> for the cover letter
    Then the selected application uploads complete
    And the saved application contains the exact selected document references
    And the application document credit and content boundary is correct
    And application document reporting remains content-free

    Examples:
      | cv      | cover   |
      | Not now | Not now |
      | Upload  | Not now |
      | Not now | Upload  |
      | Upload  | Upload  |

  @state:DEMO_READY
  Scenario: Generate both explicitly selected application documents
    When the user starts the Generate application document journey
    And the user chooses Generate for the CV and Generate for the cover letter
    Then the selected application generation completes
    And the saved application contains the exact selected document references
    And the application document credit and content boundary is correct
    And application document reporting remains content-free

  @state:DEMO_READY
  Scenario: Mix a generated CV with an uploaded cover letter
    When the user starts the Generate application document journey
    And the user chooses Generate for the CV and Upload for the cover letter
    Then the selected application uploads complete
    And the selected application generation completes
    And the saved application contains the exact selected document references
    And the application document credit and content boundary is correct
    And the uploaded application document download is private and safe
    And application document reporting remains content-free
