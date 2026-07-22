Feature: APPLY

  Scenario: Alex generates and downloads application documents
    Given Alex Taylor is logged in
    When he opens a software developer job
    And Alex generates application documents
    Then a tailored CV should be created
    And a tailored cover letter should be created
    And both documents should be available to download
