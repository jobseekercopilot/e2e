# User-capability E2E coverage matrix

Status values: **Covered**, **Partial**, **Explicit live**, or **Gap**. `Fixture` means deterministic full-stack doubles; it does not claim the real external provider.

| User capability | Critical smoke | Core regression | Extended / negative | Promo | Capacity | Boundary | Status |
|---|---|---|---|---|---|---|---|
| Register account and complete initial search setup | Yes | Yes | Keyboard validation and duplicate submit | REGISTER | No | Fixture location/email | Covered |
| Login and session establishment | Yes | Yes | Wrong/old password in reset journey | Reused by chapters | DISCOVER login | Real auth service | Covered |
| Logout and rejected reuse | Yes | Yes | Protected route remains unavailable after reload | No | No | Real auth service | Covered |
| Password reset | No | Yes | Enumeration, token persistence and session revocation | No | No | Fixture or LocalStack SES | Covered |
| Profile setup and edits | Yes | Yes | Unavailable location and duplicate save | REGISTER | No | Fixture postcode/location | Covered |
| Job search and provider presentation | Yes | Yes | Real-provider stabilisation separately gated | DISCOVER | DISCOVER | Five fixture providers | Covered |
| Job matching relevance | Indirect | Indirect | No focused ordinary assertion | DISCOVER | DISCOVER | Fixture matching | Partial |
| Location selection | Yes | Yes | Unavailable-provider feedback | REGISTER | No | Fixture location | Covered |
| Commute preferences and assessment | Preferences | Yes | No focused commute failure scenario | DISCOVER | DISCOVER | Fixture maps | Partial |
| View/select a job | Yes | Yes | Safe source-link policies below browser | DISCOVER | DISCOVER | Fixture jobs | Covered |
| Create and track an application | Yes | Yes | Cross-owner denial | TRACK | No | Real app services, fixture data | Covered |
| Change application state | Interview | Interview and offer | Invalid transitions below browser | TRACK / SUCCEED | No | Fixture state | Covered |
| Generate CV and cover letter | One representative choice | Generated/mixed choices | Cancellation and stale evidence are separately gated | APPLY | No | Fixture LLM normally; explicit live path | Covered |
| Upload existing documents | No | Four choice combinations and mixed flow | Ownership/content privacy | ORGANISE | No | Synthetic files | Covered |
| Document version/history and download | No | Exact immutable references and downloads | Cross-user denial | ORGANISE | No | Synthetic documents | Covered |
| Attach/select documents for application | Representative generate | Upload/generate/not-now combinations | Reporting/content boundary | APPLY | No | Fixture generation | Covered |
| Recover from validation/dependency failures | Registration validation | Location, password, stale evidence | Security/accessibility profiles | No | No | Controlled failures | Partial |
| Specialist NHS/apprenticeship flow | Yes | Yes | Explicit bounded live path exists | DISCOVER | DISCOVER | Fixture in regression | Covered |
| Provider outage and explicit failure contract | Lower-layer + prior live evidence | Deterministic stack-level `502` scenario | UI degradation is component-tested; live path remains gated | No | No | Fixture failure mode | Partial |
| Reporting/activity | No | Application/document privacy assertions | Content-free reporting | REPORT | No | Fixture reporting | Covered |
| Payment/credit | No | Demo-only credit presentation | Payments remain separate feature work | REPORT | No | Fixture only | Partial |

## Persona coverage

The governed `real-world-personas-v1` state provides seven machine-readable profiles: minimal, typical, rich, stress, uploaded-CV-first, manual-profile-first, and career-changer. It covers the requested returning-user shape through prepared persisted identities rather than a separate duplicate profile. Exact field sizes and the persona-by-capability assessment are recorded in [REAL_WORLD_COVERAGE_AUDIT.md](REAL_WORLD_COVERAGE_AUDIT.md).

| Persona | Profile/search | Upload | Generate | Track/return | Boundary status |
|---|---:|---:|---:|---:|---|
| Minimal | Yes | Applicable | Applicable | Prepared identity | Deterministic fixture |
| Typical | Yes | Yes | Yes | Yes | Deterministic fixture |
| Rich | Yes | Yes | Yes | Yes | Deterministic fixture |
| Stress | Contract limits | Yes | Not live-tested | Prepared identity | Large-but-valid, not max-scale |
| Uploaded-CV-first | Yes | Real PDF and DOCX | Optional | Yes | Exact SHA/reference assertions |
| Manual-profile-first | Yes | Optional | Fixture generation | Yes | Structured profile fields |
| Career-changer | Yes | Yes | Fixture generation | Yes | Transferable evidence narrative |

`Yes` denotes deterministic product/contract coverage. It does not imply a paid live-provider call. Live LLM/provider rows remain explicit and gated; no credentials were present for this validation run.

## Suite categories

- **Critical smoke:** `@critical-smoke`; registration/login/profile/location/specialist search/application start plus representative tracking/document generation.
- **Core regression:** all ordinary smoke, E2E, security and accessibility profiles, excluding separately authorised live stabilisation.
- **Extended regression:** real-provider/OpenAI stabilisation, LocalStack SES and cancellation, each with its own explicit gate.
- **Promo:** `@promo` chapter features and the existing real-UI director/fixture workflow.
- **Capacity workload:** `@capacity-workload` on the read-only DISCOVER session; concurrent browser sessions reuse the same deterministic fixture user and are reported as active sessions, not registered-user capacity.
