@smoke @framework
Feature: Automation framework safety

  Scenario: The no-secret smoke profile is isolated from demo automation
    Then the smoke execution profile is fail-closed
