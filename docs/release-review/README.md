# Document-generation and responsive product evidence

Validated on 22 August 2026 against the deterministic local E2E stack on the
`feature/document-generation-allowance-mobile` branches. The browser campaign
uses governed `REAL_WORLD_PERSONAS` data and the real application UI and service
boundaries; external providers remain fixture-backed.

## Responsive journey matrix

| Surface or journey | Desktop 1440 px | Tablet 768 px | Phones 320/360/375/390/412 px |
| --- | --- | --- | --- |
| Sign in and profile | Pass | Pass | Pass for all five personas |
| Job search, result cards and vacancy detail | Pass | Pass | Pass for all five personas |
| Save/application document choice | Covered by desktop E2E | Covered by tablet layout | Pass for all five personas |
| Generate CV and cover letter | Pass in document E2E | Covered by tablet layout | Pass; exactly two generations consumed |
| Application tracking and document history | Pass in document E2E | Covered by tablet layout | Pass |
| Allowance, pricing and generation history | Pass | Pass | Pass |
| Download generated PDF/DOCX and grounding evidence | Pass in document E2E | Covered by tablet layout | Pass for returning career-changer persona |
| Logout, login and persistence | Pass in persona E2E | Covered by tablet layout | Pass for returning career-changer persona |
| Horizontal overflow | None | None | None at every tested width |
| Primary touch controls | Not applicable | Pass | Pass at a practical 44 x 44 px minimum |

## Issues fixed during the audit

- Enlarged the account menu and job-card disclosure controls for practical touch use.
- Reflowed job-card headings and actions at narrow phone widths so actions no longer overlap.
- Allowed the single-column tablet dashboard grid and its children to shrink without horizontal scrolling.
- Added executable overflow and touch-target assertions with DOM diagnostics.
- Waited for server-owned allowance data before capturing pricing evidence.

## Evidence

Representative desktop captures are in [`desktop/`](desktop/). Phone and tablet
captures are in [`mobile/`](mobile/). During execution the campaign also writes
the generated PDF, DOCX and grounding bundle to the repository's ignored
`downloads/` runtime-artifact directory and verifies each download before the
returning-user persistence check.

The executable coverage is defined in
[`features/e2e/mobile-product-audit.feature`](../../features/e2e/mobile-product-audit.feature).
It is intentionally split into phone, tablet and desktop scenarios so a failed
responsive class can be diagnosed without rerunning unrelated personas.
