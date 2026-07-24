# Job Seeker Copilot E2E And Promo Automation

This private repository is the authoritative Playwright, Cucumber and
TypeScript automation suite for Job Seeker Copilot.

It serves two related purposes:

1. E2E regression testing for user journeys.
2. Repeatable promo recordings for product trailers, website clips and LinkedIn demos.

Its Job Search journey and evidence ownership, and its boundary with System
Data, are defined in the Infrastructure
[Job Search architecture ADR](https://github.com/jobseekercopilot/infrastructure/blob/develop/docs/adr/0001-job-search-architecture-and-ownership.md).

It is maintained independently from the Angular application and Spring Boot
services. It does not duplicate another browser framework. Demo journeys are
preserved while beta-grade execution profiles and coverage are tracked in the
[beta-readiness audit](docs/BETA_READINESS_AUDIT.md).

## Install

```bash
npm ci
npm run playwright:install
npm run verify
npm audit --audit-level=high
```

Use Node 22. Copy `.env.example` to `.env` for local overrides. Real `.env`
files, browser authentication state, reports, screenshots and recordings are
ignored and must never be committed.

## Configuration

Key variables:

```text
BASE_URL=http://localhost:4200
HEADLESS=false
SLOW_MO=150
RECORD_VIDEO=true
VIDEO_DIR=videos
DEMO_MODE=true
DEMO_RECORDING=false
DEMO_DOWNLOAD_DIR=demo-recordings/final/downloads
TYPING_DELAY_MS=65
DEMO_BUFFER_MS=2000
DEMO_SCROLL_MS=650
VIDEO_NAME=registration-demo
```

Promo recordings use Chromium, a `1920x1080` viewport, page-only Playwright video capture and timestamped file names. Recording mode sets global Playwright `slowMo` to `0` and lets the cursor, pause and intentional-scroll helpers control visible pacing.

## Run Tests

```bash
npm run test
npm run test:local
npm run test:ci
npm run verify
```

The authoritative suite uses one primary tag per feature:

| Profile | Primary tag | Command | Purpose |
|---|---|---|---|
| Demo | `@demo` | `npm run test:demo` | Preserved promo and recording journeys |
| Smoke | `@smoke` | `npm run test:smoke:ci` | No-secret framework smoke checks |
| E2E | `@e2e` | `npm run test:e2e` | Positive beta user journeys |
| Security | `@security` | `npm run test:security` | Authentication and access-control failures |
| Provider failure | `@provider-failure` | `npm run test:provider-failure` | Controlled upstream failure behaviour |
| Accessibility | `@accessibility` | `npm run test:accessibility` | Automated accessibility and resilient UX |

Secondary tags may describe a scenario, but the profile policy rejects missing
or overlapping primary tags. All imported journeys are explicitly `@demo`.
The smoke profile contains the no-browser framework check plus the `@stack`
registration, login, profile and location journeys. The stack journeys run
only through the guarded minimum stack documented in
[docs/BETA_STACK.md](docs/BETA_STACK.md); they are excluded from no-secret CI.
The accessibility profile is documented in
[docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) and is included in guarded local
`stack:verify`; CI runs its no-browser fail-closed scenario and validates all
tag/step definitions without claiming a secret-bearing Compose run.

`npm run verify` is the clean-clone baseline: tracked-file and profile-tag
policies, TypeScript, every Cucumber profile in dry-run mode, the no-secret
smoke and accessibility configuration scenarios, and Playwright support tests.
It does not claim that the broad historical Compose stack or the complete beta
browser journey passes.

## Synthetic identities and cleanup

Beta journeys must create identities with `createSyntheticEmail`, register each
one on the Cucumber world with `registerSyntheticUser`, and enable the approved
local cleanup adapter:

```text
E2E_CLEANUP_ENABLED=true
E2E_CLEANUP_BASE_URL=http://localhost:8080
```

Cleanup posts only reserved `jsc-e2e-*@users.jobseekercopilot.test` identities
to the loopback-only `/internal/test-support/users/cleanup` endpoint. It fails
closed for demo runs, remote/HTTPS targets, disabled cleanup and all other
email namespaces. `E2E_CLEANUP_TOKEN`, when the minimal stack requires it, is
runtime-only and must never be written to files or uploaded.

Stateful beta scenarios use the stronger system-data named-state lifecycle and
must use identities supplied by that state rather than registering an unrelated
cleanup identity. See [the lifecycle contract](docs/SYSTEM_DATA_LIFECYCLE.md)
for tags, endpoints, configuration and the E2E-03 minimum-stack handoff.

## Failure evidence and authentication state

Beta browser profiles retain trace, screenshot and a metadata-only JSON report
only when a scenario fails. Names combine a safe scenario slug, timestamp and
UUID, and `MAX_FAILURE_ARTIFACTS` bounds local retention (default 20 files).
CI uploads only failure screenshots and metadata reports for three days. Trace
archives remain local because they can contain request/session details; CI does
not publish them, `.auth`, environment files, demo media, cookies or reusable
storage state. Treat all retained evidence as private synthetic test material.

Reusable storage state is disabled by default and forbidden in every beta
profile. A demo operator must explicitly set both `DEMO_MODE=true` and
`SAVE_DEMO_SESSION=true` to write ignored state, or `USE_SAVED_SESSION=true` to
read it. Passing arbitrary scenarios no longer save browser state.

## Minimum beta stack

The approved nine-component stack, exact source revisions, generated local
credentials, clean build, readiness, isolated schema lifecycle, browser smoke,
dependency-failure proof, unprivileged PostgreSQL runtime, blocking image
scans, ports and troubleshooting are documented in
[docs/BETA_STACK.md](docs/BETA_STACK.md).

## Historical demo fixture preflight

The historical broad demo stack configuration remains in the parent workspace,
not this repository. Its Compose model parses but currently spans 26 services,
including unapproved legacy capabilities and stale user-management settings.
Do not use it as beta evidence. E2E-03 owns a minimum approved stack; until that
lands, run demo fixture preflight only from the controlled original workspace.

Promo and deterministic E2E runs require gateway fixture mode before Playwright starts:

```bash
# From the controlled parent workspace only; not a clean-clone command.
docker compose -f docker-compose.yml -f docker-compose.e2e.yml config
```

The verification checks `GET /internal/provider-mode` for all external gateways, validates system-data fixture endpoints, and smokes the normal gateway APIs. Do not record demo clips against live Adzuna, JSearch, Reed, postcodes.io, OpenAI or Stripe.

## Record Final Chapters

Start the isolated E2E stack first and prepare the demo fixtures:

```bash
cd /path/to/job-seeker-copilot-parent-workspace
python -m scripts.docker.start_stack e2e --build
python -m scripts.demo.prepare_demo --skip-start
```

Then record the seven final promotional chapters:

```bash
JSC_WORKSPACE_ROOT=/path/to/job-seeker-copilot-parent-workspace \
npm run record
```

The optional parent workspace is used only for the preserved demo fixture
preparation command. Generated review media stays under this repository's
ignored `demo-recordings/` directory. Set `SKIP_DEMO_PREP=true` only after an
equivalent controlled fixture preflight has succeeded.

The generated MP4s are:

```text
REGISTER.mp4
DISCOVER.mp4
APPLY.mp4
REPORT.mp4
TRACK.mp4
ORGANISE.mp4
SUCCEED.mp4
```

The output folder is cleaned at the start of each recording run:

```text
demo-recordings/final/
```

## Journey Files

```text
features/chapters/REGISTER.feature
features/chapters/DISCOVER.feature
features/chapters/APPLY.feature
features/chapters/REPORT.feature
features/chapters/TRACK.feature
features/chapters/ORGANISE.feature
features/chapters/SUCCEED.feature
```

The older `features/demo-trailer.feature` is still supported by the registration step definitions.

## Promotional Cursor And Downloads

Set `DEMO_RECORDING=true` for promo capture. This injects a dark page-level cursor overlay with a light outline. Playwright's real mouse position is the source of truth: the overlay follows browser `mousemove` and `pointermove` events while the helper drives the real mouse through eased intermediate points. Clicks show a subtle ripple at the same coordinates used by the browser, and a small download-complete toast appears only after Playwright has observed and saved the real browser download.

Document downloads are preserved under:

```text
demo-recordings/final/downloads
```

The combined generation and document-management clips save deterministic review filenames such as `alex-taylor-tailored-cv.pdf` and `alex-taylor-cover-letter.pdf` when the application exports PDF.

## Videos And Reports

Videos are saved in:

```text
e2e/playwright-cucumber/videos
```

Example:

```text
registration-demo-2026-07-09T19-24-53-446Z.webm
```

Cucumber reports are written to `reports/`, and failure screenshots are written to `screenshots/`.

## Selector Standards

Prefer selectors in this order:

1. `data-testid`
2. accessible role and visible name
3. form label
4. visible text
5. CSS selectors only as a last resort

When an element lacks a stable selector, page objects include TODO comments instead of broad CSS hacks.

Recommended `data-testid` additions include:

```text
register-full-name-input
register-email-input
register-password-input
register-next-button
register-submit-button
skill-input
target-role-input
qualification-name-input
work-history-job-title-input
home-location-input
commute-range-input
nav-dashboard
nav-find-jobs
nav-applications
nav-documents
nav-ai-credit
job-search-keywords-input
job-search-location-input
job-result-card
job-details-panel
generate-documents-button
documents-page
document-card
document-version-history
application-tracker-page
application-card
application-status-select
dashboard-page
dashboard-activity-timeline
dashboard-ai-credit-widget
ai-credit-page
ai-credit-balance
spending-log
```

## Known TODOs

- Add a demo reset endpoint or seeded demo user so promo clips can use `alex.taylor92@example.com` deterministically.
- Add deterministic document generation for `DEMO_MODE=true` so application document clips do not spend real AI credits.
- Add stable navigation routes or `data-testid`s for Documents, Applications and AI Credit.
- Never perform a real Stripe payment in promo automation; the AI credit journey stops before checkout.
- Add richer seeded demo data for documents, applications, spending log and activity timeline.

Beta-blocking audit work is tracked in private E2E-02 through E2E-05. E2E-06
tracks the five current Moderate Cucumber/uuid dependency findings and runtime
support alignment. There is no accepted Critical or High dependency finding.

## Import provenance and ownership

The source was imported from the untracked workspace directory
`e2e/playwright-cucumber` after a source-only backup and redacted secret scan on
22 July 2026. Root Git tracked none of the files, so no source history existed
to migrate. Generated videos, screenshots, reports, local auth state, caches and
environment files were deliberately excluded. The original root repository was
not changed or rewritten.

Use `feature/*` branches into `develop`. There is no application `main` branch
before beta release governance is approved. See [CONTRIBUTING.md](CONTRIBUTING.md)
and [SECURITY.md](SECURITY.md).

## Adding New Journeys

1. Add a readable chapter feature under `features/chapters`.
2. Put step definitions in the closest product-area file under `steps`.
3. Add or extend a page object under `pages`.
4. Prefer a page-object method over direct locator calls in steps.
5. Add an npm `record:*` script with a clear `VIDEO_NAME`.
