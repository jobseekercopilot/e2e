# Real-world product coverage audit — closure update, 11 August 2026

## Executive summary

The intended private-beta journey is now proven across deterministic browser,
service and bounded live integrations. The prior completion-UI, LLM grounding,
payment 404 and 25-session functional defects are fixed. The fresh 25-session
stage passes, but at 59.449 seconds p95 it is not a comfortable operating
target and does not justify a 50-session run. No AWS workload, Google call or
live Stripe transaction is claimed.

The authoritative showcase scenario passed all 26 steps before recording. It
uses one coherent candidate and job through registration, profile, discovery,
generation, document preview, application tracking, reporting and returning
state. No readiness percentage is reported.

The final gated recording also passed 26/26 steps and produced the 1920×1080,
204.4-second `demo-recordings/final/JOB-SEEKER-COPILOT-SHOWCASE.mp4` plus seven
timeline-derived feature clips. Fixture providers and the previously validated
grounded deterministic LLM response were used so the showcase is reproducible;
it does not claim that a paid live call happened during filming.

## Final blocker disposition

| Previous blocker/gap | Root cause or scope decision | Current evidence | Disposition |
| --- | --- | --- | --- |
| Generated-document completion not visible | Generated records were not consistently bound to the originating application, so exact selection/ownership reconciliation could not complete the UI state | Document journey 7/7 scenarios and 65/65 steps; full regression and master scenario pass | FIXED + VERIFIED |
| Live LLM fabricated identity/claims | Raw model output could author presentation identity and qualified claims outside the evidence ledger | Claim policy 2.24.0; 248/248 tests; six-shape live domain matrix; exact rejection/repair/quarantine | FIXED + VERIFIED |
| Pricing/wallet emitted four 404s/session | BFF deliberately registered the product route prefix as unavailable instead of forwarding the intentional payment contract | Exact same-origin allowlist, session-derived identity, CSRF mutation boundary and bounded responses; no 404s in current journeys | FIXED + VERIFIED |
| 25 sessions failed at job-details/card expansion | Immutable result refresh changed the Job Card tracking key and recreated expanded components | Stable job-ID tracking and regression protection; fresh 25/25 completes | FIXED + VERIFIED; LATENCY LIMIT RETAINED |
| CV-to-profile extraction absent | UI/API/docs promise file upload, management and application linking, not profile construction | Upload never mutates profile and no import contract exists | POST-BETA / OUT OF SCOPE |
| AWS workload unproven | No usable AWS access/session credentials or safe deployed benchmark target was available | Credential/configuration audit; zero resources created and $0 spend | STILL NOT VALIDATED ON AWS |
| Google/live Stripe | Disabled or not configured for the intended local beta topology | Deterministic boundaries remain green | NOT CONFIGURED; NOT CLAIMED LIVE |

## Seven governed personas

Canonical source:
`system-data-service/src/main/resources/personas/personas.json`. All identities
are synthetic and use `example.com`. The `real-world-personas-v2` named state
retains idempotent prepare, verify and reset with seven users/profiles.

| Persona | Purpose | Browser result | Grounding result |
| --- | --- | --- | --- |
| `minimal-profile` | Sparse/null handling | Register/onboard, sparse profile, search, match and generation pass | Restrained output; no invented identity, employer or qualification |
| `typical-profile` | Ordinary returning user | Complete normal journey passes | Useful evidence-grounded tailoring |
| `rich-profile` | Detailed employment/qualification mapping | Profile, match, generation and Documents pass | Prioritises supplied evidence |
| `very-rich-profile` | Realistic boundary shape | Load/edit/save/reload/search/match/generation pass | Coherent long-input result; no unsupported claims |
| `uploaded-cv-first` | File-first application path | Upload/manage/search/generation pass | Uploaded evidence used only where supported |
| `manual-profile-first` | Structured data before later upload | Profile survives subsequent upload and generation | Existing profile remains authoritative |
| `career-changer` | Transferable evidence without invented target experience | Profile, match and generation pass | Teaching history remains teaching history; transferable skills are reframed |

The full browser regression includes the shared seven-persona replay and passed
23/23 core E2E scenarios. Purpose-sized scenarios avoid seven copies of one
expensive journey while retaining the meaningful assumption for each profile.

## Profile source of truth and boundary

Identity belongs to Authentication/User Management. Structured skills, roles,
qualifications, preferences, location, availability and evidence belong to User
Profile and its evidence APIs. Immutable purpose-bound evidence snapshots feed
generation. Uploading a CV creates an owner-scoped application document; it
does not write candidate profile fields.

| Persona | JSON bytes | Text characters | Scalar fields | Skills | Roles | Qualifications | Longest string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Minimal | 860 | 274 | 28 | 3 | 0 | 0 | 36 |
| Typical | 1,583 | 678 | 56 | 10 | 2 | 1 | 94 |
| Rich | 2,472 | 1,268 | 84 | 20 | 3 | 3 | 143 |
| Very rich | 8,348 | 5,339 | 234 | 60 | 18 | 6 | 259 |
| Uploaded CV first | 1,550 | 687 | 50 | 6 | 2 | 1 | 92 |
| Manual first | 1,925 | 933 | 62 | 12 | 2 | 2 | 134 |
| Career changer | 2,097 | 1,058 | 65 | 12 | 2 | 3 | 177 |

The very-rich fixture represents a plausible senior consultant with eighteen
distinct engagements. It remains below the product's explicit maxima and is a
realistic boundary, not a maximum transport/database proof. Save/reload,
rendering, matching and generation pass within this boundary; no larger claim
is made.

## Generation and grounding

The model may select, reorder, summarise and professionally rephrase supplied
evidence. It cannot author identity, contact, employment, qualifications,
technologies, dates, quantified achievements, leadership scope, references,
salary, right-to-work or other biographical facts.

Protection is architectural rather than prompt-only:

- purpose-bound immutable evidence selection and exact-path claim ledger;
- strict output schema and locally rendered candidate identity/contact data;
- exact rejection of placeholder identity/reference text and unsupported
  qualified leadership/management claims;
- paragraph and numeric-claim repair only where supplied evidence supports it;
- final validation before persistence/approval;
- safe failure and quarantine when repair cannot establish grounding.

All six representative shapes passed the current paid domain-service path.
Across the retained closure sampling, OpenAI handled 17 calls with 80,012 input
and 23,419 output tokens. Exact per-call summed spend was **$0.069487**. The
last coherent CV-plus-cover-letter operation used two calls, 13,729 input and
3,661 output tokens, and cost **$0.011350**. The dated rate basis is $0.40 per
million input tokens and $1.60 per million output tokens for the pinned GPT-4.1
mini model. Full provider payloads are not committed or published.

## Upload and document lifecycle

Supported product scope is upload/manage/link application documents.
Automatic extraction into the profile is neither exposed nor promised.

| Shape or behaviour | Result |
| --- | --- |
| Ordinary PDF and DOCX | Browser path passes; original type and bytes retained |
| One-page, multi-page, short and substantial CVs | Supported boundaries covered through browser/service fixtures |
| Unsupported extension, corrupt PDF/DOCX, empty file and MIME mismatch | Rejected with bounded user-visible recovery; no raw stack trace |
| Oversized and unsafe archive shapes | Rejected by owner controls; no document record is promoted |
| Scanner rejection/unavailable/timeout and extraction failure | Controlled failure contracts and browser-facing recovery are covered |
| Duplicate/version flow | Exact immutable family/version/checksum references retained |
| Private download | Owner authorization, correct content type, attachment and private/no-store controls pass |
| Uploaded plus generated | Coexist and can be selected independently for the same application |

Generated records are associated with the originating application. The
Documents and Tracker views use the exact chosen versions instead of silently
selecting an arbitrary CV or cover letter.

## Tracking and reporting reconciliation

Application records keep the selected job, exact documents, supported status
and activity history across logout/login. Reporting is calculated from the
same owner-scoped application/activity records and is content-free,
private/no-store.

The deterministic reconciliation covers:

- empty user: all totals and status/date buckets are zero;
- small history: known application count and statuses equal the API and UI;
- rich history: totals, status distribution, activity/date buckets and
  progression calculations equal the seeded source ledger.

The expected-versus-actual ledger is retained with the E2E evidence and the
core regression passes. No metric is accepted solely because a chart renders.

## Provider classification

| Integration | Classification | Current evidence |
| --- | --- | --- |
| Reed | VALIDATED LIVE + deterministic | Bounded real search plus governed synthetic search/detail |
| Adzuna | VALIDATED LIVE + deterministic | Bounded real search; an empty bounded result is treated as valid |
| JSearch/RapidAPI | VALIDATED LIVE + deterministic | Bounded real search plus adapter/rate boundary |
| NHS Jobs | VALIDATED LIVE + deterministic | Current specialist path exercised |
| Find an apprenticeship | VALIDATED LIVE + deterministic | Current specialist path exercised |
| OpenAI | VALIDATED LIVE + deterministic | Six-shape domain matrix and exact spend ledger |
| Google location/maps | NOT CONFIGURED | Disabled in current beta topology; fixture location does not claim live Google |
| Stripe | DETERMINISTICALLY VALIDATED | No usable live credentials/transaction in this run |

Live job data remains quarantined, runtime-ineligible and excluded from the
public evidence site. No provider payload was promoted into governed fixtures.

## Complete regression evidence

| Check | Result |
| --- | --- |
| Full Cucumber regression | PASS: 32 scenarios / 244 steps (5 smoke, 23 core E2E, 1 security, 1 provider failure, 2 accessibility) |
| Browser support suite | PASS: 54/54 |
| Angular client | PASS: 460/460, lint and production Docker build |
| CV/cover-letter domain | PASS: 248/248 |
| Infrastructure | PASS: 109/109 |
| Application Tracker | PASS: 154 tests |
| Document Generation Gateway | PASS: 131 tests |
| Document Store | PASS: 152 tests |
| Job Service | PASS: 90 tests, one intentional skip |
| System Data | PASS: 86 tests |
| User Management Gateway | PASS: 93 tests |
| Authoritative showcase pre-recording | PASS: 1 scenario / 26 steps |
| Strict MkDocs build | PASS |

## Fresh capacity result

The workload uses real fixture-backed browsers and the full Docker product
topology. It is not a registered-user, host-wide or live-provider benchmark.
Browser CPU/RAM is outside Docker stats.

| Stage | Sessions | Session p95 | Response p50/p95/p99 | Peak Docker CPU | Peak Docker memory | Result |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| Idle | — | — | — | 27.83% | 7.83 GiB | healthy |
| 1 | 1/1 | 5.969 s | 9 / 182 / 182 ms | 317.05% | 8.01 GiB | pass |
| 5 | 5/5 | 10.340 s | 15 / 571 / 1,107 ms | 258.86% | 8.14 GiB | pass |
| 10 | 10/10 | 16.995 s | 26 / 709 / 970 ms | 782.91% | 8.35 GiB | pass |
| 15 | 15/15 | 25.971 s | 46 / 472 / 961 ms | 714.42% | 8.42 GiB | pass |
| 20 | 20/20 | 40.432 s | 63 / 609 / 2,248 ms | 702.47% | 8.66 GiB | pass |
| 25 | 25/25 | 59.449 s | 71 / 546 / 1,207 ms | 566.73% | 8.64 GiB | functional pass; not comfortable |

The former 0/25 boundary was a frontend identity problem: an immutable refresh
added a canonical ID, changed the Job Card tracking key and recreated the
expanded component. Stable primary job-ID tracking now preserves component
identity. At 25 sessions the remaining constraint is end-to-end browser session
latency under heavy simultaneous activity, not an observed OOM or unhealthy
service. Application Tracker (89.73%), authentication (76.02%), User Profile
(66.68%) and User Management (63.84%) had the highest sampled per-container CPU
peaks. One 25-session Docker stats request failed while nine valid samples were
retained. No 50-session run was attempted because 59.449 seconds is not a
comfortable margin against the 60-second scenario budget.

## AWS, economics and readiness boundary

No AWS workload was run. The current `m7i.2xlarge` 8-vCPU/32-GiB candidate and
approximately **$340.33/month** London compute allocation are calculated from
the fresh local evidence and dated public AWS pricing, not measured on AWS. A
cautious operating cap is approximately 15 simultaneous active sessions until
an AWS test establishes otherwise.

The economics evidence models low, typical and heavy generation using exact
model spend and transparently excludes database, storage, network, load
balancers, NAT, logs, metrics, backups, email, payment fees, support and tax
where they cannot yet be measured. Candidate packages are decision support,
not a production pricing change or profit claim.

## Remaining limitations

- Public GitHub Pages publication is disabled; the strict local site is current.
- AWS workload performance, live Google and live Stripe remain unvalidated.
- The 25-session local functional pass is not an operating recommendation.
- Automatic CV-to-profile construction is post-beta/out of current scope.
- Permanent, fixed-term and apprenticeship profile filters need a future
  downstream contract decision without blocking the proven showcase journey.
