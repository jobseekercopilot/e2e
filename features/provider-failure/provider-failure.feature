@provider-failure @stack @core-regression
Feature: Controlled external provider failure

  @state:PROVIDER_FAILURE
  Scenario: The fixture provider boundary reports an explicit unavailable response
    When the deterministic provider-failure boundary is requested
    Then the provider failure is reported without returning fixture jobs
