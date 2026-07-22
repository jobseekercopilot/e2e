Feature: Generate tailored application documents

  Scenario: Alex generates a CV and cover letter for a selected job
    Given Alex Taylor is logged in
    When he opens a software developer job
    And Alex generates application documents
    Then a tailored CV should be created
    And a tailored cover letter should be created
    And both documents should be available to download
