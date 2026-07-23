# Accessibility and resilient UX evidence

The `@accessibility` profile is the authoritative automated browser evidence
for the selected user-management beta path. It extends the existing
Playwright/Cucumber framework and runs only against the guarded local Compose
stack with system-data named states.

## Automated scope

`npm run stack:accessibility` proves:

- axe-core has no detected violations at registration steps 1, 2 and 3, the
  authenticated profile, and the profile location-failure state;
- an invalid keyboard submission moves focus to the assertive error summary and
  marks the related field invalid;
- the claimant can complete onboarding with native keyboard interaction,
  including location selection;
- rapid repeated activation produces one registration request and one profile
  update request;
- location lookup exposes a loading announcement followed by stable,
  non-leaking unavailable guidance;
- named-state preparation/reset, no saved authentication state, failure traces,
  screenshots and bounded metadata follow the framework-wide safety controls.

`npm run stack:verify` includes this profile after the existing browser smoke
journeys and before the controlled postcode dependency-failure proof. The
client source is pinned to the reviewed CLIENT-13 merge in
`config/beta-stack-sources.json`.

CI runs `npm run test:accessibility:ci`, a no-browser scenario that proves the
profile disables demo mode and reusable authentication state. It also dry-runs
all accessibility steps. The live axe and journey evidence remains a guarded
local-stack check because CI does not receive the stack's generated runtime
credentials.

## Manual WCAG 2.2 AA review

Automation is not a complete conformance claim. For a beta release, record the
browser and assistive-technology versions while checking:

1. NVDA with Firefox or VoiceOver with Safari announces labels, instructions,
   progress, errors, busy state and the resulting profile in a useful order.
2. Registration, sign-in, profile editing and location selection remain usable
   at 200% zoom and at a 320 CSS-pixel reflow width without two-dimensional
   scrolling.
3. Text, controls and focus indicators meet contrast requirements in default
   and forced-colours modes.
4. Reduced-motion mode removes non-essential movement without hiding status.
5. Keyboard focus remains visible and logical through browser back/forward,
   reload and error recovery.

Promo-only overlays and demo cursor behavior are excluded by the profile tag
and fail-closed configuration. Findings must become focused issues; exceptions
must identify the WCAG criterion, affected state, owner and time-bounded review
date.
