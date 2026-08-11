@security @application-documents @core-regression
Feature: Application document ownership is enforced at the browser boundary

  @state:CROSS_USER_SECURITY
  Scenario: A second owner cannot inspect another owner's upload or application
    Given the first cross-user identity is signed in
    When the owner starts the Add application document journey
    And the owner chooses Upload for the CV and Not now for the cover letter
    Then the selected application uploads complete
    And the saved application contains the exact selected document references
    And the second cross-user identity is denied the first owner's upload and application
