@demo
Feature: TRACK

  Scenario: Alex moves an application to interview
    Given Alex Taylor is logged in
    When he opens the application tracker
    And he focuses a software developer application
    And he moves an application to interview
    Then the tracker shows the application at interview
