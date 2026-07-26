# Beta-readiness audit: browser automation

Audit date: 22 July 2026; dependency evidence refreshed 26 July 2026

Status: **Not beta-ready.** The existing Playwright/Cucumber source has an
independent private home and beta-safe execution foundations, but an approved
minimal stack, complete security/provider/accessibility journeys and
environment evidence remain open.

## Responsibilities and consumers

This repository owns cross-repository browser automation, page objects,
synthetic browser fixtures, execution profiles and failure artifacts. It does
not own application behavior, production deployment, provider datasets or
service contracts. Existing demo scenarios and recording helpers remain useful
but are not beta evidence.

CLIENT-07 consumes its beta/security journeys. CLIENT-08 consumes its
accessibility and resilient-UX evidence. UMG-07, AUTH-09, PROFILE-07, LOC-06 and
POSTCODE-06 own lower service boundaries that browser scenarios integrate but
do not replace.

## Import and build evidence

- Original location: untracked root `e2e/playwright-cucumber`; root Git tracked
  zero files and therefore supplied no useful source history.
- A verified source-only backup contained 79 entries. Generated videos,
  screenshots, reports, auth state, caches and local environment files were
  excluded; the original root repository was not modified or rewritten.
- Gitleaks 8.30.1 scanned approximately 46.9 MB of the current source and
  generated artifacts before import and found no leaks.
- Isolated `npm ci`, TypeScript checking, a 19-scenario/113-step Cucumber
  dry-run and 15 Playwright support tests passed.
- E2E-02 verification covers 20 scenarios/114 steps across all dry-run
  profiles, one executable no-secret smoke scenario, and 22 Playwright tests.
- A refreshed audit of the old Cucumber 11 lock on 26 July found four High and
  four Moderate findings, superseding the original five-Moderate snapshot.
  Cucumber 13.2.0 removes the affected transitive tree; the replacement lock
  has zero known findings.
- Node 24.18.0 LTS is the supported baseline. The repository accepts newer
  Node 24 security patches, while local verification rejects older and
  non-24 runtimes.

## Findings

| Issue | Finding | Severity / priority | Dependency | Beta blocker |
|---|---|---|---|---|
| E2E-01 | Import and baseline the authoritative framework | High / P1 | None | Yes |
| E2E-02 | Add tagged profiles, isolated cleanup and CI artifacts | High / P1 | E2E-01 | Implemented; merge evidence in issue |
| E2E-03 | Replace the broad stale 26-service Compose path with the minimum approved stack | High / P1 | E2E-01/02, SD-07/09 and E2E-10 | Remediation in delivery |
| E2E-04 | Prove complete beta auth/profile/location security and provider failures | High / P1 | E2E-02/03 and service test blockers | Yes |
| E2E-05 | Add accessibility and resilient-UX evidence | Medium / P1 | E2E-02/03 and CLIENT-08 complete | Remediated in repository |
| E2E-06 | Align supported Node and remediate dependency findings | High / P1 | E2E-01 | Resolved by supported Cucumber 13.2.0 and Node 24 LTS alignment |
| E2E-10 | Prevent false-green zero-commit secret scans | High / P1 | None | Implemented; merge evidence in issue |

## Current Compose assessment

The parent-workspace Compose configuration parses and maps the client to port
3100, but it starts 26 services. It includes out-of-scope legacy services,
stale H2 auth/profile configuration, no merged JWT/JWKS/service-identity/session
settings and a system-data fixture dependency. It was not started during this
audit and must not be used as beta evidence. System-data is now independently
audited and SD-07 supplies its bounded E2E client; E2E-03 owns the minimum
replacement stack and actual cross-service proof.

The E2E-03 implementation defines nine approved components, loopback-only
ports, PostgreSQL/Flyway, asymmetric JWT/JWKS, cookie/CSRF and distinct
service/environment credentials. Exact clean private source revisions are
checked before generated runtime configuration is written mode `0600`.
Postcode behavior is fixture-backed through system-data with no live provider.
Clean Maven verification and no-cache image builds pass at the pinned revisions.
All eight distinct images have zero fixed Critical/High findings under pinned
Trivy 0.72.0. The nine-service stack reaches healthy, its three browser
scenarios pass all 14 steps, a stopped postcode dependency produces a bounded
HTTP 504 without implementation leakage, recovery succeeds, and final teardown
removes the containers, network and both database volumes.

## E2E-02 evidence

- Historical scenarios are retained under `@demo`; smoke, E2E, security,
  provider-failure and accessibility have explicit non-overlapping profiles.
- A checked policy rejects feature files with missing or multiple primary tags.
- Collision-resistant identities use a reserved `.test` namespace. Cleanup is
  opt-in, rejects non-synthetic users, and is restricted to HTTP loopback.
- Beta Cucumber hooks retain unique, bounded traces, screenshots and sanitized
  metadata reports only on failure. Reusable state is demo-only and opt-in.
- CI executes a no-secret framework smoke and uploads only screenshots and
  sanitized metadata for three days; trace archives stay local to avoid
  publishing session details. Product smoke journeys await E2E-03's stack.

## SD-07 lifecycle integration

- Stateful scenarios bind to one validated system-data named state. Hooks run
  describe, prepare and verify before the browser and reset after success or
  failure; E2E contains no database seeding or provider acquisition code.
- The typed client accepts only bounded loopback/Compose targets, requires the
  runtime caller key, validates response shapes and never echoes response
  bodies, URLs or keys in errors.
- Deterministic local-double tests cover the complete HTTP contract, unsafe
  configuration, profile/state separation, best-effort recovery, cleanup after
  failure and preservation of the original scenario error.
- E2E-03 still owns actual Compose startup and cross-service persistence proof;
  this repository remains not beta-ready until that evidence and E2E-04/05 pass.

## Definition of Done

- Clean private clone installs and verifies with a supported Node LTS.
- Demo, smoke, E2E, security, provider-failure and accessibility profiles are
  separate and documented.
- The minimum approved local stack builds, starts, becomes ready and resets
  only synthetic data reproducibly.
- Tests use isolated identities, bounded cleanup and no LIVE external provider.
- Failure traces, screenshots and reports are useful, short-lived and contain
  no exposed cookie/token/auth state.
- CI runs an appropriate smoke subset plus dependency and full-history secret
  gates; no unaccepted Critical/High finding remains.
- Registration, login, reload/refresh/expiry/logout, profile, location,
  unauthenticated/cross-user, provider-failure and accessibility journeys pass.
- Documentation states exact ownership, commands, limitations and evidence.

This Definition of Done has not yet been demonstrated. Do not call the browser
path or overall user-management path beta-ready.
