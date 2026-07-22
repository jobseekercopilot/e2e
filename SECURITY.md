# Security policy

Report suspected vulnerabilities privately to the repository owner. Do not put
credentials, cookies, tokens, personal data, exploit details, authentication
state, screenshots of user data or production logs in an issue or artifact.

Only synthetic isolated accounts may be used. Cleanup must be environment-
bounded and must never target production or non-test users. Browser state and
failure artifacts may contain session or personal data: keep them ignored,
short-lived and access-controlled, and redact them before sharing.

Never switch beta/demo tests to uncontrolled LIVE providers, weaken an
authentication control, bypass a failed security check or claim beta readiness
from demo scenarios. Current blockers and residual risks are recorded in
`docs/BETA_READINESS_AUDIT.md`.

CI runs a disposable synthetic-leak policy test before its complete-history
scan. The read-only scanner mount is configured as a safe Git directory inside
the container, Git must enumerate non-empty history, and Gitleaks must report a
non-zero commit count. Discovery errors and zero-commit scans fail closed;
scanner output is redacted.
