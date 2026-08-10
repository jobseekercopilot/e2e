# Product-confidence automation audit

Date: 10 August 2026

## Existing capability retained

- One authoritative browser stack already exists: Playwright, Cucumber, TypeScript and Chromium with page objects and a 1920×1080 recording context.
- Infrastructure owns the complete `job-seeker-copilot-e2e` Compose stack, fixture-mode validation, named-state preparation/reset, health waiting and workspace locks.
- Browser profiles already separate demo, smoke, E2E, security, provider-failure, accessibility and explicitly authorised live stabilisation.
- Synthetic users, reserved email namespaces, loopback-only cleanup, deterministic System Data states and fail-closed real-provider/AI gates already exist.
- Seven final promo chapters already use the real UI, visible cursor/director effects, controlled pauses, downloads, WebM capture and MP4 conversion.
- Failed beta scenarios already retain private screenshots and local traces. This task extends metadata with the failed scenario, bounded console errors and sanitised failed HTTP requests.
- Every service exposes a Compose health check. Spring services expose Actuator health; selected services already have Micrometer counters/timers, but there is no fleet-wide Prometheus collection.
- The low-memory overlay supplies explicit JVM/container ceilings and is useful as a constraint test, not as proof of production sizing.

## Existing journey coverage

- Registration, login, profile/location changes, specialist job search, apprenticeship details, application creation/tracking and application state progression have deterministic browser coverage.
- Password reset covers non-enumeration, token removal, session revocation and email delivery through fixture/LocalStack boundaries.
- Application document tests cover independent upload/generate/not-now choices, exact version references, ownership isolation, reporting privacy and persisted generated documents.
- Live stabilisation separately proves real-provider search and opt-in real OpenAI generation; ordinary regression does not claim those integrations.
- Accessibility covers keyboard onboarding, error focus, unavailable location feedback and duplicate-submit prevention.

## Gaps found

- No capability-level matrix or stable `critical`/`regression` entry points existed.
- Provider-failure has a profile but no current feature file; failure isolation is covered in lower layers and specialist smoke, but needs a future deterministic browser scenario.
- Logout is not asserted as a dedicated browser capability.
- Job matching and commute display are exercised indirectly, not protected by focused acceptance assertions in the ordinary critical suite.
- Upload/generation coverage is comprehensive but relatively expensive, so only one representative generation choice belongs in critical smoke.
- Failure JSON previously omitted step/scenario, console and network context.
- Promo recording supported the complete chapter set but not a documented individual-clip command.
- There was no repeatable per-container CPU/RAM sampler, concurrent active-session workload, benchmark schema, capacity report or unit-cost evidence boundary.
- Browser host CPU/RAM and container CPU/RAM are distinct; Docker statistics alone cannot be presented as total test-host consumption.
- Paid/external consumption metrics are service-specific. Fixture benchmarks correctly measure paid calls as zero and cannot be used to infer live LLM/maps/provider unit cost.

## Ownership decision

- `e2e` owns user journeys, page objects, browser diagnostics, promotional recordings and the reusable fixture-browser capacity journey.
- `infrastructure` owns stack preflight, Docker resource collection, workload orchestration, retained benchmark evidence and capacity/AWS reporting.
- No new browser framework, reduced Compose topology or monorepo dependency is introduced.
