@demo @promo
Feature: ORGANISE

  Scenario: Alex organises generated documents
    Given Alex Taylor is logged in
    When he opens the documents workspace
    Then generated documents should be visible if demo data exists
    And he opens document version history if available
    And he previews and downloads stored documents if available
