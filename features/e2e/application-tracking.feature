@e2e
Feature: Deterministic application tracking

  @state:DEMO_READY
  Scenario: A seeded application progresses to interview and persists
    Given Alex Taylor is logged in
    When he opens the application tracker
    And he focuses a software developer application
    And he moves an application to interview
    Then the tracker shows the application at interview

  @state:DEMO_READY
  Scenario: A seeded interview progresses to offer and persists
    Given Alex Taylor is logged in
    When he opens the application tracker
    And he moves an interview application to offer
    Then the tracker shows the application as offer secured
