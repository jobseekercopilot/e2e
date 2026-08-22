@e2e @application-documents @core-regression
Feature: Uploaded and generated documents remain explicit application choices

  Background:
    Given the primary named-state user is signed in

  @state:CROSS_USER_SECURITY
  Scenario Outline: Add a saved application with independent upload choices
    When the user starts the Add application document journey
    And the user chooses <cv> for the CV and <cover> for the cover letter
    Then the selected application uploads complete
    And the saved application contains the exact selected document references
    And the application document generation allowance and content boundary is correct
    And application document reporting remains content-free

    Examples:
      | cv      | cover   |
      | Not now | Not now |
      | Upload  | Not now |
      | Not now | Upload  |
      | Upload  | Upload  |

  @state:CROSS_USER_SECURITY
  Scenario: Upload a real DOCX package as the application CV
    When the user starts the Add application document journey
    And the user uploads a valid DOCX CV and skips the cover letter
    Then the selected application uploads complete
    And the saved application contains the exact selected document references
    And the application document generation allowance and content boundary is correct
    And the uploaded application document download is private and safe

  @state:CROSS_USER_SECURITY
  Scenario: Upload a substantial two-page PDF as the application CV
    When the user starts the Add application document journey
    And the user uploads the substantialMultiPagePdf CV fixture and skips the cover letter
    Then the selected application uploads complete
    And the saved application contains the exact selected document references
    And the application document generation allowance and content boundary is correct
    And the uploaded application document download is private and safe

  @state:CROSS_USER_SECURITY
  Scenario Outline: Reject impossible CV files in the browser before sending bytes
    When the user starts the Add application document journey
    Then the browser rejects the <fixture> CV fixture before upload

    Examples:
      | fixture        |
      | unsupportedText |
      | emptyPdf        |
      | oversizedPdf    |

  @state:CROSS_USER_SECURITY
  Scenario Outline: Reject unsafe CV content and recover with a replacement
    When the user starts the Add application document journey
    And the user uploads the <fixture> CV fixture and skips the cover letter
    Then the CV upload is safely rejected without changing the application
    And the user can recover with a valid replacement CV

    Examples:
      | fixture                 |
      | malformedPdf             |
      | spoofedDocx              |
      | mismatchedPdf            |
      | externalRelationshipDocx |
      | traversalDocx            |

  @state:DEMO_READY @critical-smoke
  Scenario: Generate both explicitly selected application documents
    When the user starts the Generate application document journey
    And the user chooses Generate for the CV and Generate for the cover letter
    Then the selected application generation completes
    And the saved application contains the exact selected document references
    And the application document generation allowance and content boundary is correct
    And application document reporting remains content-free

  @state:DEMO_READY @critical-smoke
  Scenario: Generated documents remain exact through user-controlled application progression
    When the user starts the Generate application document journey
    And the user chooses Generate for the CV and Generate for the cover letter
    Then the selected application generation completes
    And the saved application contains the exact selected document references
    And the generated application survives refresh and explicit lifecycle progression

  @state:DEMO_READY
  Scenario: Mix a generated CV with an uploaded cover letter
    When the user starts the Generate application document journey
    And the user chooses Generate for the CV and Upload for the cover letter
    Then the selected application uploads complete
    And the selected application generation completes
    And the saved application contains the exact selected document references
    And the application document generation allowance and content boundary is correct
    And the uploaded application document download is private and safe
    And application document reporting remains content-free
