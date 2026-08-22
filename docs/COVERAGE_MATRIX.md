# User-capability E2E coverage matrix

Status values: **Covered**, **Partial**, **Explicit live**, or **Gap**. `Fixture` means deterministic full-stack doubles; it does not claim the real external provider. Results are current to 15 August 2026.

| User capability | Critical smoke | Core regression | Extended / negative | Promo | Capacity | Boundary | Status |
|---|---|---|---|---|---|---|---|
| Register account and complete initial search setup | Yes | Yes | Keyboard validation and duplicate submit | REGISTER | No | Fixture location/email | Covered |
| Login and session establishment | Yes | Yes | Wrong/old password in reset journey | Reused by chapters | DISCOVER login | Real auth service | Covered |
| Logout and rejected reuse | Yes | Yes | Protected route remains unavailable after reload | No | No | Real auth service | Covered |
| Password reset | No | Yes | Enumeration, token persistence and session revocation | No | No | Fixture or LocalStack SES | Covered |
| Profile setup and edits | Yes | Yes | Unavailable location and duplicate save | REGISTER | No | Fixture postcode/location | Covered |
| Job search and provider presentation | Yes | Yes | Real-provider stabilisation separately gated | DISCOVER | DISCOVER | Five fixture providers | Covered |
| Job matching relevance | Meaningful match | Seven aligned persona paths across software, administration, finance and project support | Provider and irrelevant-result filtering retained | DISCOVER | DISCOVER | Fixture matching | Covered |
| Location selection | Yes | Yes | Unavailable-provider feedback | REGISTER | No | Fixture location | Covered |
| Commute preferences and assessment | Preferences | Yes | Unavailable location and field-contract assertions | DISCOVER | DISCOVER | Fixture location; Google disabled | Covered |
| View/select a job | Yes | Yes | Safe source-link policies below browser | DISCOVER | DISCOVER | Fixture jobs | Covered |
| Create and track an application | Yes | Yes | Cross-owner denial | TRACK | No | Real app services, fixture data | Covered |
| Change application state | Interview | Interview and offer | Invalid transitions below browser | TRACK / SUCCEED | No | Fixture state | Covered |
| Generate CV and cover letter | One representative choice | Generated/mixed choices | Cancellation and stale evidence are separately gated | APPLY | No | Fixture LLM normally; explicit live path | Covered |
| Upload existing documents | No | Four choice combinations and mixed flow | Ownership/content privacy | ORGANISE | No | Synthetic files | Covered |
| Automatically populate a profile from an uploaded CV | No | No | Not exposed or promised | No | No | Out of intended beta scope | Explicitly out of scope |
| Document version/history and download | No | Exact immutable references and downloads | Cross-user denial | ORGANISE | No | Synthetic documents | Covered |
| Attach/select documents for application | Representative generate | Upload/generate/not-now combinations | Reporting/content boundary | APPLY | No | Fixture generation | Covered |
| Recover from validation/dependency failures | Registration validation | Location, password, uploads and stale evidence | Security/accessibility/provider-failure profiles | No | No | Controlled failures | Covered |
| Specialist NHS/apprenticeship filtering | Apprenticeship start; unrelated NHS vacancy filtered | Apprenticeship positive and NHS negative assertions | Explicit bounded live path exists | DISCOVER | DISCOVER | Fixture in regression | Partial |
| Provider outage and explicit failure contract | Lower-layer + live evidence | Deterministic stack-level `502` scenario | Provider-failure profile and component degradation tests | No | No | Fixture failure mode | Covered |
| Reporting/activity | No | Empty/small/rich exact reconciliation | Content-free, private/no-store reporting | REPORT | No | Fixture reporting | Covered |
| Payment/pricing/wallet | Exact server-owned catalogue, free allowance and acknowledgements | Signed completion/replay, expiry/no-charge and cancel-to-late-completion reconciliation | Return URL cannot fulfil; visible history and exact API ledger agree | No | No | Test-only Stripe session signs the normal verified webhook; durable Payment fulfilment; live Stripe disabled | Covered |

The current E2E-profile definition dry run resolves **31 scenarios / 236
steps**. The public-beta payment acceptance slice accounts for **4 scenarios /
33 steps** and passed **4/4 scenarios / 33/33 steps** against the isolated
fixture stack on 15 August 2026. The tagged run exercised the signed Stripe
webhook path through durable Payment reconciliation; no live provider was
enabled or called.

## Persona coverage

The governed `real-world-personas-v2` state provides seven machine-readable profiles: minimal, typical, rich, very-rich, uploaded-CV-first, manual-profile-first, and career-changer. It covers the requested returning-user shape through prepared persisted identities rather than a separate duplicate profile. Exact field sizes and the persona-by-capability assessment are recorded in [REAL_WORLD_COVERAGE_AUDIT.md](REAL_WORLD_COVERAGE_AUDIT.md).

| Persona | Profile/search | Upload | Generate | Track/return | Boundary status |
|---|---:|---:|---:|---:|---|
| Minimal | Yes | Not in replay | CV + cover letter | Tracked application + downloads | Sparse administrative evidence remains grounded |
| Typical | Yes | Not in replay | Yes | Tracked application reference | Complete generated-CV journey |
| Rich | Yes | Not in replay | Yes | Tracked application reference | Detailed evidence survives reload and grounds generation |
| Very rich | Yes | Not in replay | Yes | Tracked application reference | 18-engagement boundary; not maximum scale |
| Uploaded-CV-first | Yes | Dedicated mixed-flow coverage | CV + cover letter | Tracked application + downloads | Finance evidence grounds an Accounts Assistant application |
| Manual-profile-first | Yes | Dedicated upload coverage | CV + cover letter | Tracked application + downloads | Structured evidence remains unchanged after generation |
| Career-changer | Yes | Not in replay | CV + cover letter | Tracked application + downloads | Transferable teaching evidence grounds programme-support outputs |

This table records the shared `REAL_WORLD_PERSONAS` browser replay; upload and broader document coverage are recorded in the capability rows above. Dataset 1.2 adds six wholly synthetic aligned vacancies and retains provider-neutral deterministic execution. The replay does not imply a paid call for every row. Bounded Reed, Adzuna, JSearch and OpenAI validation is reported separately; Google and live Stripe are not configured.

## Suite categories

- **Critical smoke:** `@critical-smoke`; registration/login/profile/location/specialist search/application start plus representative tracking/document generation.
- **Core regression:** all ordinary smoke, E2E, security and accessibility profiles, excluding separately authorised live stabilisation.
- **Extended regression:** real-provider/OpenAI stabilisation, LocalStack SES and cancellation, each with its own explicit gate.
- **Promo:** `@promo` chapter features and the existing real-UI director/fixture workflow.
- **Capacity workload:** `@capacity-workload` on the read-only DISCOVER session; concurrent browser sessions reuse the same deterministic fixture user and are reported as active sessions, not registered-user capacity.
