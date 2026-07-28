@e2e @stack @account-email @state:LOGIN_SESSION
Feature: Secure password recovery

  Scenario: A claimant resets a forgotten password without account enumeration or token persistence
    Given the named-state user "login-primary" has an account
    And account email capture is empty
    When the claimant signs in on two browser sessions
    Then both browser sessions are authenticated
    When the claimant requests a password reset for the registered email
    Then the browser shows the approved generic password-reset response
    When the claimant requests a password reset for an unknown email
    Then the browser shows the approved generic password-reset response
    And no account email was sent for the unknown email
    When the claimant opens the account-email-delivered reset link
    Then the reset token is removed from the browser URL and is not stored
    When the claimant chooses a secure replacement password
    Then the previous browser sessions and refresh paths are revoked
    And the old password is rejected
    And the password-changed account email is delivered
    And the password reset succeeds and the replacement password can sign in
