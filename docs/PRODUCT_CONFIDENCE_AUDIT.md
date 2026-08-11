# Product-confidence automation audit

Date: 11 August 2026

## Outcome

The intended private-beta journey is now supported by current deterministic,
browser, service and bounded live evidence. The former document-completion,
grounding, payment-404 and 25-session functional blockers are fixed and
verified. This is not a public-beta or AWS-performance claim: the 25-session
local stage is too close to the workload timeout for an operating target, no
AWS workload was run, and the public Pages deployment is not enabled.

## Authoritative journey

`features/showcase/PRODUCT-SHOWCASE.feature` is the single release-confidence
path. Alex registers, onboards, creates a substantial profile, discovers one
job, opens its details, generates and visibly reviews a grounded CV and cover
letter, sees both in Documents, advances the same application, reconciles
Reporting, signs out, signs in again and verifies that the profile, documents,
application and reporting state remain. The pre-recording run passed one
scenario and all 26 steps.

## Current validation

- Full browser regression: 32/32 scenarios and 244/244 steps across smoke, core
  E2E, security, provider failure and accessibility.
- Browser support suite: 54/54.
- Angular client: 460/460 tests, lint and production Docker build passed.
- CV/cover-letter domain: 248/248, including grounding rejection, repair and
  quarantine paths under claim policy 2.24.0.
- Infrastructure: 109/109, strict Pages build passed.
- Six changed Java services: 706 tests, zero failures/errors and one intentional
  skip in Job Service.
- Seven governed personas pass purpose-sized browser replay as part of core
  regression; System Data retains 7/7 lifecycle verification.
- Reporting retains exact empty, small and rich-history expected-versus-actual
  reconciliation.
- Valid PDF/DOCX and user-visible invalid-upload paths are covered without
  claiming automatic CV-to-profile extraction.

## Live and external boundary

Reed, Adzuna, JSearch, NHS Jobs and Find an apprenticeship were exercised
through their real integrations in bounded sampling. OpenAI was exercised
through the domain-service path after deterministic grounding repair. Across
the retained validation runs it made 17 calls using 80,012 input and 23,419
output tokens for exact summed model spend of **$0.069487**. The final product
operation cost $0.011350. Provider searches exposed no incremental charge.

Google is disabled/not configured for the current beta environment and was not
called. Stripe remains deterministically validated; no usable live Stripe
configuration was used. AWS had no usable session/access credentials or safe
deployment prerequisite, so no resources were created and no AWS workload is
claimed.

## Capacity boundary

Fresh fixture-browser stages passed idle, 1, 5, 10, 15, 20 and 25 sessions.
The 25-session stage completed 25/25 with zero application errors, restarts,
OOM or unhealthy containers, but session p95 was 59.449 seconds against the
60-second scenario budget. One Docker stats request failed while nine valid
samples remained. The honest operational recommendation is approximately 15
concurrent active sessions on the calculated `m7i.2xlarge` candidate until an
AWS workload validates a higher target. A 50-session run was intentionally not
attempted.

## Scope decisions and remaining limitations

- The product promises upload/manage/link application documents, not automatic
  construction of a profile from an uploaded CV. Import is post-beta/out of
  current scope and is not implied in the UI or showcase.
- Local fixture capacity is not registered-user scale, host-wide capacity or
  AWS measurement. Browser processes run outside the sampled containers.
- Google and live Stripe remain explicitly unvalidated rather than simulated
  as live.
- Public GitHub Pages publication remains disabled; local strict build and
  preview evidence are current.
- Permanent, fixed-term and apprenticeship preference propagation still needs
  an explicit downstream filter-contract decision; it is not required by the
  proven master journey.

## Ownership

`e2e` owns the browser journeys, diagnostics and promotional recording.
`infrastructure` owns stack preflight, workload orchestration, retained
capacity evidence and the public-safe engineering site. Owning services retain
their API, persistence, security and domain-policy tests. No second E2E
framework or reduced product topology was introduced.
