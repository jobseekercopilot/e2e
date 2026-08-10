# Real-world product coverage audit — 2026-08-10 to 2026-08-11

## Executive summary

Overall confidence is **partial**. The product has unusually strong
deterministic state, service-contract, document-lineage and fixture-backed
browser foundations, but it is not yet credible to describe the whole system as
public-beta ready for varied real users.

The strongest areas are owner isolation, deterministic job/provider behaviour,
generated-document evidence, application/document relationships, and retained
capacity evidence. The weakest areas are CV-to-profile extraction/import (no
current end-to-end product contract was found), live LLM quality sampling,
browser execution across all personas, and capacity above ten active DISCOVER
sessions.

Public-beta blockers/gates:

1. The retained 25-session workload completed 0/25 journeys at the job-details
   path; 10/10 is the highest successful point.
2. Four pricing/wallet route 404s were observed per measured session.
3. The required six-case paid LLM grounding/latency/cost sample has not run;
   no provider credentials were available to this workspace process.
4. CV-to-profile extraction/import must either be implemented and validated or
   excluded explicitly from product and promotional claims.
5. The calculated AWS candidate has not been benchmarked on AWS.

No single readiness percentage is reported.

## Personas

Canonical owner:
`system-data-service/src/main/resources/personas/personas.json`.
All identities are fictional, use `example.com`, and are prepared by the
`REAL_WORLD_PERSONAS` / `real-world-personas-v1` named state. The rebuilt local
stack successfully completed prepare twice, verify (7 users and 7 profiles),
and reset on 10 August 2026, proving idempotent lifecycle persistence.

| Persona | Meaningful difference | Main risk represented |
| --- | --- | --- |
| `minimal-profile` | 3 skills, one target, no roles/qualifications | Null/empty handling and hallucinated experience |
| `typical-profile` | 10 skills, 2 roles, one qualification | Everyday engaged returning user |
| `rich-profile` | 20 skills, 3 detailed roles, 3 qualifications | Complete mapping, reload and downstream use |
| `stress-profile` | 60 skills, 7 roles, 6 qualifications | Rendering, serialization, prompt growth and field limits |
| `uploaded-cv-first` | Part-time accounts candidate with retained document intent | File-first behaviour and original-file lineage |
| `manual-profile-first` | Carefully entered project profile before later upload | Non-destructive merge and deduplication expectations |
| `career-changer` | Teacher targeting project coordination | Transferable skills; past role must not become target role |

`typical-profile` is also the gradual-entry/returning-user baseline. Persona
definitions use current supported fields only; unsupported desirable concepts
are recorded as gaps rather than smuggled into fixtures.

## Product coverage matrix

Legend: **PASS** = retained passing evidence; **ADDED** = automated coverage
implemented but not executed against the full stack in this pass; **API/INT** =
service/contract or integration layer is the chosen level; **SAMPLE** = bounded
live validation required; **GAP** = no sufficient current evidence.

| Journey | Minimal | Typical | Rich | Stress | Uploaded CV | Manual first | Career changer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Register/onboard | existing E2E | existing E2E | API | API | existing E2E basis | existing E2E basis | API |
| Create/edit profile | state + API | state + E2E basis | state + INT | state + boundary | state | state | state + INT |
| Save/reload | API | existing E2E basis | INT | INT required | API | API | API |
| Search jobs | API/E2E decision | PASS baseline | INT | performance sample | API | API | E2E decision |
| Matching/job details | API | PASS baseline | INT | performance sample | API | API | E2E decision |
| Location/commute | deterministic API | E2E basis | INT | INT | API | API | INT |
| Upload application CV | — | PDF PASS basis | API | boundary fixtures | PDF + DOCX PASS | DOCX PASS basis | API |
| Generate CV/letter | SAMPLE | fixture PASS | SAMPLE | long-input SAMPLE | SAMPLE | fixture | SAMPLE |
| Documents | API | PASS baseline | INT | INT | E2E decision | E2E decision | API |
| Application tracker | API | PASS baseline | INT | INT | API | API | API |
| Reporting | empty API | PASS baseline | INT | substantial history | API | API | API |
| Logout/login/return | existing E2E | existing E2E | API | API | E2E decision | E2E decision | API |

The matrix is deliberately not converted into hundreds of browser scenarios.
Field limits, mappings and failure semantics belong at unit/integration level;
the UI is retained for genuinely user-visible journeys.

## Profile/data source-of-truth matrix

| Data field / concept | Frontend | Gateway/API | Owning service / persistence | System Data | E2E | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Name, email, account ID | Header/session surfaces | User Management/Auth | Authentication Service | Named-state identity | registration/login | Not part of `UserProfile`; correct ownership |
| Skills | Tag input | User Profile 2.2.0 | `user_profile_skills` | all personas | profile/search | Max 100 × 100 chars |
| Target roles | Tag input | `Aspirations.targetRoles` | `user_profile_target_roles` | all personas | search | Max 50 × 100 chars |
| Target weekly hours | displayed/retained, no dedicated current editor | `TargetWeeklyHours` | `user_profile.target_weekly_hours` | all personas | partial | Generated clients agree on enum |
| Canonical location | autocomplete/select | `PostcodeLocation` | embedded `user_profile` columns | all personas | profile/location | ID, display, country, type, precision, confidence and provenance supported |
| Distance and travel modes | profile editor | `WorkPreferences` | profile + collection table | all personas | partial | 0–500 miles; DRIVE/TRANSIT |
| Maximum commute time | conditional inputs | `maximumDrivingMinutes`, `maximumTransitMinutes` | profile columns | all personas | partial | 5–180; mode required |
| Employment types | choice chips | `EmploymentType` | collection table | all personas | propagation INT | Permanent/fixed/temp/apprenticeship/contract |
| Working patterns | choice chips | `WorkingPattern` | collection table | all personas | propagation INT | 8 supported enum values |
| Workplace arrangement | choice chips | ONSITE/HYBRID/REMOTE | collection table | all personas | search E2E basis | Current clients agree |
| Availability / notice | date or days | mutually exclusive fields | profile columns + DB check | all personas | partial | Date or 0–3650 days, never both |
| Roles/history | Evidence manager + legacy profile | `Role` and Evidence APIs | legacy role + evidence entry/revision/fact | persona roles migrate | generation INT | Role max 50; responsibility max 2,000 |
| Qualifications | Evidence manager + legacy profile | `Qualification` and Evidence APIs | legacy qualification + evidence | persona qualifications migrate | generation INT | Max 50; completed/in-progress |
| Projects/achievements/freelance/volunteering/career breaks | Evidence manager | Evidence 2.2.0 | versioned evidence tables | demo generation evidence; persona seed relies on migration for legacy fields | generation E2E basis | Current first-class model is evidence, not extra profile columns |
| Portfolio links | Evidence manager | `supportingLinks` | evidence revision links | not persona-seeded | API | No separate portfolio profile object |
| Evidence snapshots | generation selector | purpose-bound immutable snapshot API | snapshot/selection/fact tables | fixture generation | deep INT/E2E | CV and cover-letter purposes are separate |
| Profile revision/digest | conflict/error UI | ETag/revision/digest | optimistic concurrency + digest | assigned by owner | API/INT | Read-only to clients |
| Onboarding/completeness | progress copy computed in UI | no persisted domain field | not owned | journey behaviour only | E2E | Do not invent persisted completeness state |
| Professional summary | not a profile editor field | absent | absent | absent | GAP | Generated CV summary is document output, not claimant profile input |
| Preferred industries / salary expectation / target locations list | not current profile fields | absent from User Profile | absent | absent | GAP | Job Search request can express some concepts, but profile cannot retain them |
| Languages / right to work | absent | absent | absent | absent | GAP | Unsupported, not silently fabricated |
| CV-derived profile import | no established review/import flow found | no current extraction/import contract found | no owning persistence flow found | absent | GAP | Application-document upload exists; profile import must not be implied |

### Data-propagation result

The User Profile 2.2.0 producer contract and Job Finder's pinned copy have the
same SHA-256 (`f81c90a8…a75`). The current User Management/Angular models expose
the structured fields. A real defect was found in Job Finder: it ignored
`workPreferences.employmentTypes` and `workingPatterns`, deriving only the
legacy weekly-hours value. The gateway now carries supported contract/temp and
full/part-time filters while retaining weekly-hours fallback, with an
integration test covering commute and workplace fields too.

Permanent, fixed-term and apprenticeship are not representable by Job Service's
current search-filter enum without conflating contract type and working hours.
They remain an explicit downstream contract gap.

## Profile size and boundary measurements

Measurements are deterministic compact JSON before owner-generated IDs,
revisions and evidence migration.

| Persona | JSON bytes | Text chars | Skills | Roles | Qualifications | Longest string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Minimal | 860 | 274 | 3 | 0 | 0 | 36 |
| Typical | 1,583 | 678 | 10 | 2 | 1 | 94 |
| Rich | 2,470 | 1,268 | 20 | 3 | 3 | 143 |
| Stress | 5,123 | 3,161 | 60 | 7 | 6 | 285 |
| Uploaded CV first | 1,550 | 687 | 6 | 2 | 1 | 92 |
| Manual first | 1,924 | 933 | 12 | 2 | 2 | 134 |
| Career changer | 2,097 | 1,058 | 12 | 2 | 3 | 177 |

The stress persona remains below explicit product maxima (100 skills, 50 roles,
50 qualifications and 2,000-character responsibility fields). This is a
realistic long-career input, not a transport-limit test. Max-constraint and
request-size enforcement remain service tests; full-stack stress save/reload
and prompt tokenisation are still required before claiming the boundary passed.

## System Data reconciliation

### Current deterministic operations

| Integration/domain | Current product operation | Deterministic owner | Result |
| --- | --- | --- | --- |
| Reed | search and job detail | governed job dataset | search/detail retained; fixture diversity includes hidden/null salary cases |
| Adzuna | search | governed job dataset | retained |
| JSearch | search | governed job dataset | retained |
| NHS Jobs | specialist search | gateway-local fixture | retained outside System Data; ownership documented |
| Find an apprenticeship | specialist search | gateway-local fixture | retained outside System Data; ownership documented |
| Postcodes.io | postcode and UK place search | System Data | **place search added in this task** |
| Google Maps | autocomplete/resolve/routes matrix | disabled in E2E | explicit live/optional gap; no fake route claim |
| OpenAI | generation | System Data LLM fixture | retained; fixture contract brought to current combined output |
| Stripe | checkout/webhook support | System Data Stripe fixture + gateway | deterministic response retained |
| Auth/profile/payment/documents/applications | reset/seed/verify | owning-service internal boundaries orchestrated by System Data | runtime-owner compatibility fixed in the production-confidence branch |

### Updates made

- Added seven machine-readable personas and a complete named state.
- Added catalog validation and size-variation regression tests.
- Exercised the state against Authentication and User Profile containers. The
  first run exposed missing grades on completed qualifications; the personas
  were corrected to the owning service's real validation rule before the
  successful 7/7 lifecycle proof.
- Included current canonical location provenance, commute, structured work and
  availability fields.
- Preserved User Profile ownership; System Data sends public contracts and lets
  the owner migrate legacy roles/qualifications to evidence.
- Added deterministic bounded place search and its producer OpenAPI operation.
- Replaced the E2E Compose default dataset `1.1.0` (which did not exist) with
  the governed `1.0.0` dataset.
- Retained prior runtime-owner reset/verify fixes across Application Tracker,
  Document Store and Payment.
- Retained current combined CV/cover-letter fixture output and evidence-aware
  LLM adapter fixes.

### Remaining drift/gaps

- System Data's fixture OpenAPI covers fixture responses; environment-management
  routes remain documented/tested but lack a separate published OpenAPI source.
- NHS/apprenticeship fixtures are gateway-local and therefore absent from the
  governed multi-provider dataset.
- Google autocomplete/resolve/routes have no deterministic System Data
  operation because the E2E overlay disables Google; this should remain an
  explicit design decision.
- Evidence categories beyond legacy role/qualification are not part of the new
  persona seed boundary yet.
- No CV-to-profile extraction/import operation exists to reconcile.

## CV upload matrix

The product currently exposes application-document upload, not a verified
CV-to-profile import workflow.

| Shape/failure | Fixture/evidence | Result |
| --- | --- | --- |
| Valid text PDF | real in-memory PDF package uploaded through browser journey | Existing PDF flow retained |
| Valid DOCX | real ZIP/OOXML package | Full-stack browser PASS: upload, immutable SHA/reference, no credit, authenticated format-specific download and private/no-store headers |
| Short/limited CV | deterministic PDF text fixture | File accepted at application boundary; profile extraction not applicable |
| Duplicate/second upload | independent application-document choices | Operation/version semantics covered at service/API level; dedicated user-facing scenario remains partial |
| Uploaded + generated documents | mixed CV/cover-letter choices | Existing E2E coverage |
| Corrupt PDF | truncated PDF fixture | Unit/integration rejection coverage; UI wording needs retained full-stack evidence |
| Spoofed DOCX | PDF bytes with DOCX metadata | rejection fixture retained |
| Empty/image-only | empty-text PDF fixture | extraction/usefulness boundary retained; no profile-import claim |
| Oversized | 10 MiB + 1 byte fixture | limit fixture retained |
| External relationship / archive traversal | safe adversarial OOXML fixtures | rejection controls retained without live malware |
| Scanner rejection/timeout | service failure contracts | integration coverage exists; browser UX matrix remains incomplete |

Original application uploads retain source SHA-256, source type and private,
no-store attachment download headers. Malware and unsafe-archive fixtures do
not contain real malicious payloads.

## Provider evidence

No authenticated live provider calls were made in this pass because provider
credentials were unavailable. Current official documentation was reviewed:

- Reed documents search pagination using `resultsToTake/resultsToSkip`, nullable
  salary when hidden, and a separate job-detail operation:
  <https://www.reed.co.uk/developers/jobseeker>.
- Adzuna documents page-number paths, `results_per_page`, nested location area,
  nullable/optional salary and JSON result diversity:
  <https://developer.adzuna.com/docs/search>.
- JSearch remains a RapidAPI-mediated provider with plan/rate semantics; its
  deterministic adapter must not be treated as equivalent to Reed/Adzuna.

The synthetic dataset retains provider identity and three provider-specific
records each. It should not be described as a live sample dated 2026-08-10.

## LLM evidence

Deterministic generation is grounded by selected evidence facts and a claim
ledger. Prior focused tests protect separate CV/cover-letter purpose selection
and reject ungrounded combined-fixture assumptions.

The required live cases (rich, typical, minimal, career changer, uploaded CV,
and long stress input) were **not executed**: no `OPENAI_API_KEY` was present in
the environment or approved local env files. Therefore hallucination rate,
live latency and live token distributions remain unknown. Exact paid spend is
**$0.00**, recorded in
`infrastructure/docs/real-world-validation-costs-2026-08-10.md`.

The dated official GPT-4.1 mini rate remains $0.40/million input and
$1.60/million output tokens. The 2,100/1,600-token fixture shape calculates to
$0.00340 for a combined generation; that is calculated, not a live bill.

## Documents, tracking and reporting

- Demo state contains nine applications, nineteen document records, an uploaded
  revised DOCX, generated PDFs, exact family/version/checksum references and
  mixed supported statuses.
- Supported tracker statuses are `DOCUMENTS_GENERATED`, `APPLIED`, `INTERVIEW`,
  `UNSUCCESSFUL`, `OFFER`, `ACCEPTED`, `REJECTED_BY_USER`, and `WITHDRAWN`.
- Application-document choices preserve exact active versions rather than
  silently selecting any CV.
- Reporting requests are asserted content-free, private/no-store and derived
  from application/activity records. Empty, one/several and rich-history data
  levels still need one consolidated reconciliation result table.
- Login/reload/expiry/logout named states and restored-runtime checks cover
  returning behaviour; the seven personas are not yet all replayed in browsers.

## Defects

| Severity/class | Evidence | Outcome |
| --- | --- | --- |
| Fixture/system-data drift | E2E configured nonexistent dataset `1.1.0`; catalog owns `1.0.0` | Fixed |
| Significant functional drift | Fixture postcode provider rejected the newly used place-search operation | Fixed with bounded System Data API + gateway mapping |
| Significant data propagation | Structured employment/working patterns were silently ignored by Job Finder | Fixed with integration protection |
| Fixture drift | Runtime account cleanup routes were missing/incompatible across three owning services | Fixed in current branch set |
| Persona contract drift | Several completed qualifications omitted the service-required grade | Found by full-stack prepare; fixed and 7/7 verified |
| Operator tooling drift | Reset helper incorrectly expected a populated-state verify to pass after deletion | Fixed; reset now trusts its bounded deletion result |
| Runtime/source drift | Cached Document Generation JAR exposed 2.6 upload APIs while its checked-out source branch predated them; Document Store source branch also predated its merged upload API | Switched both to current integrated source, rebuilt runtime artifacts, and reran DOCX to PASS |
| Significant/product gap | CV-to-profile extraction/import not found | Open; do not imply capability |
| Public-beta performance blocker | 0/25 DISCOVER journeys passed | Open |
| Significant defect | four pricing/wallet 404s per measured session | Open |
| Coverage gap | six paid LLM samples absent | Open; credentials unavailable |

## Remaining gaps

- Retain browser save/reload/search evidence for at least minimal, typical,
  rich and stress; the 7/7 backend lifecycle is complete.
- Retain UI-facing invalid-upload results alongside the completed real DOCX
  browser scenario.
- Decide and document whether CV-to-profile import is in current beta scope.
- Run the six bounded LLM samples once a credential is supplied, then update the
  cost ledger and grounding review.
- Run limited authenticated live provider comparisons, subject to provider
  terms and credentials.
- Reconcile reporting totals in one retained source-record/result artifact.
- Resolve 25-session latency and payment 404s, then rerun capacity.
- Record the master and at least one alternative workflow only after these
  product-confidence gates; no new recording is claimed by this audit.
