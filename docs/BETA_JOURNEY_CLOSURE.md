# Beta journey closure — 14 August 2026

This is the working closure ledger for the intended beta journey. A requirement
is marked verified only after current-branch evidence exists. Historical results
remain evidence, but are not silently treated as proof after behaviour changes.

| Requirement | Initial state | Fix | Validation | Final state |
| --- | --- | --- | --- | --- |
| Document generation completion UI ([client#100](https://github.com/jobseekercopilot/job-seeker-copilot-client/issues/100)) | Backend draft, operation polling and approval completed, but 2/7 focused browser scenarios timed out waiting for visible completion | Selective generation now binds each created Document Store record to the originating `applicationId`, allowing Tracker's exact owner/application validation to accept the final selection | `DurableGenerationServiceTest`: 45/45 passed; focused generated/generated and generated/uploaded scenarios passed independently; rebuilt-stack feature: 7/7 scenarios and 65/65 steps passed in 49.517s | VERIFIED |
| LLM identity and claim grounding ([cv-cover-letter-service#67](https://github.com/jobseekercopilot/cv-cover-letter-service/issues/67)) | A six-call raw LLM Gateway sample bypassed the domain service and exposed invented identity/contact/reference filler plus one overstated leadership phrase | Claim policy 2.24.0 combines schema validation, exact-path evidence ledger checks, locally rendered contact identity, numeric/paragraph claim repair, rejection and quarantine; the model can rephrase supplied evidence but cannot author candidate facts | 248/248 domain tests passed. Six representative profile shapes passed through the real domain-service/OpenAI path; final bounded evidence totals 17 calls, 80,012 input and 23,419 output tokens, with exact per-call summed spend of $0.069487 | FIXED + VERIFIED |
| Pricing/wallet 404 traffic | Four application 404s were observed per measured session; Payment Gateway received no request because the BFF deliberately registered `404 FEATURE_NOT_AVAILABLE` | Replaced the disabled prefix with an exact same-origin route allowlist. Owner identity is derived from the HttpOnly UMG session, browser identity headers are discarded, mutations require matching CSRF, and downstream responses are bounded/validated | Client production build passed; 32 test files and 449 tests passed; unauthenticated pricing fails closed with 401; the authenticated 7-scenario browser run produced Payment Gateway pricing/wallet 200 responses (typically 5–15 ms) with no payment 404s | VERIFIED |
| CV-to-profile scope | No extraction/import contract or owning workflow was found | Product scope is A: upload and manage an application CV. The UI, APIs and current documentation expose file upload/linking/versioning only and do not promise automatic profile construction | Source/UI/API/documentation audit; existing profile data is never mutated by the upload route | VERIFIED — EXTRACTION IS OUT OF BETA SCOPE |
| Realistic profile boundary | Largest canonical persona was about 5 KiB with 60 skills, 7 roles and 6 qualifications | Replaced by a plausible 18-engagement senior consultant fixture: 60 skills, 18 roles, 6 qualifications, 8,348 JSON bytes and 5,339 text characters | Lifecycle and profile evidence persistence/reload are protected across all seven personas. Generation runs for the three software-role personas with deterministic fixture results; four non-software personas assert explained empty states rather than selecting unsuitable work | FIXED + VERIFIED WITHIN DOCUMENTED LIMITS |
| Seven-persona browser replay | System Data lifecycle passed 7/7; browser coverage was selective | Added shared, purpose-sized journeys for minimal, typical, rich, very-rich, uploaded-first, manual-first and career-change personas | Full regression: all 27 core E2E scenarios passed, including seven-persona replay; complete regression total 36 scenarios / 276 steps | FIXED + VERIFIED |
| Complete upload UX | Real DOCX passed; adverse shapes were principally lower-layer evidence | Added browser-visible valid PDF/DOCX and invalid upload/recovery coverage while retaining owner-level safety controls | Full regression and upload owner suites pass; upload, private download, checksum, lineage, MIME and no-store assertions retained | FIXED + VERIFIED FOR SUPPORTED SHAPES |
| Reporting reconciliation | Empty/populated reporting paths existed without one retained expected-vs-actual ledger | Added deterministic empty, small and rich-history source-to-API-to-UI reconciliation | Seven-persona/reporting regression passed; exact expected-versus-actual reconciliation artifact retained with the E2E evidence | FIXED + VERIFIED |
| Authoritative beta journey | No complete registration-to-returning-user scenario had passed | Added one coherent Alex persona and selected job from registration through generation, documents, tracking, reporting and returning-user persistence | `features/showcase/PRODUCT-SHOWCASE.feature`: 1 scenario / 26 steps passed before promotional rendering | FIXED + VERIFIED |
| Regression suite | Previous focused suites passed; full post-fix regression not run | Completed the post-fix client, service, browser, security, accessibility, provider-failure and infrastructure suites | Full browser regression 36/36 scenarios and 276/276 steps; support 59/59; client 487/487; CV 277/277; infrastructure 117/117; four final-fix Java services 503 tests, 0 failures/errors and 1 intentional skip | FIXED + VERIFIED |
| Fresh capacity boundary | Historical 10/10 passed and 0/25 failed at job details | Preserved card component identity across immutable refreshes and hardened the sampler; reran clean idle, 1, 5, 10, 15, 20 and 25 stages | All stages completed; 25/25 passed with 59.449 s session p95, zero application errors/restarts/OOM. One Docker stats sample failed but nine valid samples remain | FIXED FUNCTIONALLY; 25 IS NOT A COMFORTABLE OPERATING TARGET |
| AWS workload validation | Candidate shapes were calculated from local evidence only | Checked the supplied secret/configuration sources for safe AWS prerequisites | No usable AWS access keys/session credentials or live deployment path existed; no AWS resources were created and spend was $0 | ACCEPTED VALIDATION LIMITATION — NOT MEASURED ON AWS |
| Economics and pricing decision aid | Historical local capacity and six-call LLM sample underpinned the model | Recalculated against the fresh benchmark, dated London AWS price snapshot and exact 17-call model ledger | Low/typical/heavy generation and candidate package scenarios are published with excluded costs and commercial assumptions | FIXED + VERIFIED AS DECISION SUPPORT |
| Pages evidence | Strict local build passed; GitHub Pages itself is disabled ([infrastructure#90](https://github.com/jobseekercopilot/infrastructure/issues/90)) | Refreshed confidence, testing, personas, readiness, capacity, AWS, economics, validation costs and methodology pages | Strict MkDocs build passes and the source evidence is retained; public deployment remains an admin/integration action | FIXED LOCALLY; PUBLIC DEPLOYMENT STILL BLOCKED |
| Master showcase and feature clips | Deliberately not recorded because product gates failed | Recording is gated by the same authoritative journey; stale evidence-count assertions were made category-specific and tolerant only of additional confirmed entries | Recorded scenario passed 26/26 steps; `recording-report.json` and media probes verify one 1920×1080, 204.4-second master plus seven 1920×1080 clips | FIXED + VERIFIED |

## Branch and evidence boundary

The coordinated fixes were developed on scoped branches from their locally
known `origin/develop` revisions and verified together in the isolated fixture
stack. This ledger records behavioural evidence rather than a mutable branch,
pull-request or deployment status.

The final evidence distinguishes fixture-backed regression, bounded live
provider/OpenAI sampling, local capacity measurements, calculated AWS pricing
and the explicitly absent AWS workload run. It does not present local Docker
measurements as AWS results or deterministic provider responses as live calls.

## Promotional artifact

The master is
`demo-recordings/final/JOB-SEEKER-COPILOT-SHOWCASE.mp4`. It is 1920×1080 and
204.4 seconds long. `npm run record:showcase` reruns fixture-provider preflight,
the authoritative journey, gated capture, H.264 conversion, chapter extraction
and media probing. The output uses the validated deterministic LLM response;
all real providers are disabled for reproducibility. The generated CV and cover
letter PDFs shown in the video are retained in `demo-recordings/final/downloads/`.
