@demo
Feature: SUCCEED

  Scenario: Alex secures an offer after interview
    Given Alex Taylor is logged in
    When he opens the application tracker
    And he moves an interview application to offer
    Then the tracker shows the application as offer secured
    And the promo shot pauses at the final trailer state
