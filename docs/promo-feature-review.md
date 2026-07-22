# Promo feature review

Date: 2026-07-11

Scope: first automated promotional recording pass for the existing Job Seeker Copilot Angular client and Playwright/Cucumber framework.

## Client inspection summary

- Main navigation: authenticated dashboard shell with top header, profile dropdown, AI Credit widget, and workspace tabs for Search Results, My Applications, and Documents.
- Strong screens: onboarding card, populated dashboard shell, job match cards with source badges and expandable details, generated document success/download state, documents workspace summaries, application timeline cards, AI Credit summary/spending log, and reporting activity panels.
- Weak or empty screens: documents, applications, spending log, and activity timeline depend heavily on seeded/generated state. The E2E journeys currently tolerate empty fixture states so clips still complete, but those clips are visually weaker if demo data is missing.
- Recording mode: existing config already supports `DEMO_MODE`, slow motion, demo pauses, smooth scrolling, fixed 1920x1080 viewport, and page-level video. The missing piece was stable MP4 collection.
- Fixture safety: the demo prep command verifies fixture modes and refuses the live frontend port 3000. Recording should use `E2E_BASE_URL=http://localhost:3100`.

## Feature review

| Feature | Product capability shown | Starting state | Ending state | Visible action | Works for recording | Looks good enough | Selector improvements | Recommended length | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01-registration | Account creation and profile onboarding | Anonymous visitor on landing/onboarding card | Authenticated dashboard shell | Form entry, tags, qualification, work history, location, create profile | Yes, if backend auth/profile stack is seeded/reset | Yes, one of the strongest clips | Add `data-testid` for create tab, registration fields, next/submit buttons, qualification and role add buttons | 45-75s | Remain |
| 02-dashboard-reveal | Dashboard workspace and user profile context | Saved Alex Taylor session | Dashboard with profile, job matches, AI Credit and reporting panels | Opens dashboard and pauses | Yes with saved session from registration | Yes when profile/job data is present | Add `data-testid="dashboard-page"` and widget IDs for AI Credit, applications, documents, reporting | 8-14s | Remain |
| 03-job-search | Job match discovery | Saved session on dashboard | Job results panel with relevant matches | Opens Search Results, refresh/search if controls exist, scrolls results | Yes | Yes, especially with multiple fixture jobs | Add test IDs for search inputs if manual search form returns | 15-25s | Remain |
| 04-job-details | Job detail inspection and generation entry point | Saved session | Expanded job card details | Opens first relevant job and reveals description/actions | Yes | Yes | Add `data-testid="job-details-panel"` and stable title/action IDs | 12-20s | Remain |
| 05-generate-application-documents | Tailored CV and cover letter generation | Saved session and expanded software developer job | Combined success/download state | Clicks the combined generate button with visible cursor, waits for loading/success, points at both results, downloads both files | Safe when deterministic generation fixtures are active | Strong if seeded downloads are present | Keep `generate-documents-button`; add document result test IDs if possible | 10-15s | Replace separate CV/cover-letter clips |
| 07-document-management | Document library, versions, preview and downloads | Saved session | Documents workspace with list or empty state | Opens Documents, expands first document, shows details, downloads and previews saved PDF when available | Yes | Strong with seeded documents; weak if empty | Add `data-testid="document-version-history"` and preview controls to expanded details | 18-30s | Remain |
| 08-application-tracking | Application tracker and status progression | Saved session | Applications workspace and status/timeline controls | Opens Applications and attempts status change | Yes, but status action selector is loose | Strong with seeded applications; weak if empty | Add `data-testid="application-status-select"` or stable status menu items | 12-24s | Remain |
| 09-dashboard-activity | Reporting activity timeline | Saved session | Dashboard reporting panel/activity area | Scrolls to Recent activity or dashboard state | Yes | Strong only after generated/tracked activity exists | Add `data-testid="dashboard-activity-timeline"` to reporting panel | 10-18s | Remain |
| 10-ai-credit | AI Credit balance and usage | Saved session | AI Credit widget/spending log area | Scrolls to AI Credit, confirms no checkout starts | Yes | Summary is good; spending log depends on fixture transactions | Add `data-testid="ai-credit-balance"` and `data-testid="spending-log"` | 8-16s | Remain |
| 99-marketing-trailer | End-to-end story from onboarding to job/application activity | Anonymous visitor | Final dashboard/activity state | Registration, search, detail, documents, applications, activity | Yes if all supporting journeys are healthy | Useful as rough trailer, not final advert | Same selectors as component clips | 75-120s | Remain |

## Recording command

Use this from `e2e/playwright-cucumber`:

```bash
npm run record
```

The command writes the final chapter set to:

```text
demo-recordings/final/
```

The final recorder runs `scripts.demo.prepare_demo` before recording, enables fixture-backed generation for the recording process, adds `DEMO_RECORDING=true`, uses the promotional cursor/director overlay, verifies Playwright downloads, saves review downloads, and emits the single chapter set:

```text
REGISTER.mp4
DISCOVER.mp4
APPLY.mp4
REPORT.mp4
TRACK.mp4
ORGANISE.mp4
SUCCEED.mp4
```

Set `SKIP_DEMO_PREP=true` only when the fixture-backed E2E stack has already been prepared and verified.
