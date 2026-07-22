Feature: Application tracking promo clip

  Scenario: Alex moves an application to interview
    Given Alex Taylor is logged in
    When he opens the application tracker
    And he focuses a software developer application
    And he moves an application to interview
    Then the tracker shows the application at interview

  Scenario: Alex secures an offer after interview
    Given Alex Taylor is logged in
    When he opens the application tracker
    And he moves an interview application to offer
    Then the tracker shows the application as offer secured
