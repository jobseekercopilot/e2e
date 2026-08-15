# System-data named-state lifecycle

The E2E repository is a client of `jobseekercopilot/system-data-service`. It
does not seed databases, construct delete predicates, or call provider APIs.
System-data owns the versioned catalog and coordinates service-owned internal
state endpoints.

## Scenario binding

Every stateful beta feature must have one primary execution tag and each
scenario must resolve to exactly one named-state tag:

```gherkin
@e2e @state:PROFILE_LOCATION
Feature: Profile and location
```

Supported names mirror the system-data `EnvironmentScenario` contract:

```text
EMPTY
REGISTRATION_CLEAN
LOGIN_SESSION
PROFILE_LOCATION
DUPLICATE_REGISTRATION
CROSS_USER_SECURITY
REAL_WORLD_PERSONAS
PROVIDER_FAILURE
PAYMENT_ACCEPTANCE
DEMO_READY
```

`PROVIDER_FAILURE` is accepted only by the provider-failure profile.
`DEMO_READY` is accepted only by the demo and full E2E profiles, and other
states are not accepted for demo lifecycle automation. `REAL_WORLD_PERSONAS`
is accepted by the full E2E profile and prepares seven fictional current-profile
contracts; it does not grant live-provider or paid-AI access. The `@framework` smoke
is deliberately stateless and does not contact system-data.

`PAYMENT_ACCEPTANCE` is restricted to the full E2E profile. It prepares a
free document-credit wallet and an authenticated fixture identity, resets both
the Payment and Stripe fixture aggregates, and verifies their exact owned
state. Its payment-event control is a caller-key-protected System Data proxy;
the browser cannot grant credits directly.

## Runtime contract

For a stateful scenario the hooks execute:

```text
GET  /internal/environments/states/{scenario}
POST /internal/environments/prepare       {"scenario":"<NAME>"}
GET  /internal/environments/verify?scenario=<NAME>
browser journey
POST /internal/environments/reset         {"scenario":"<NAME>"}
```

The payment acceptance journey may also ask System Data to emit a bounded
terminal event for a fixture Checkout session:

```text
POST /internal/environments/payment-fixtures/checkout-sessions/{sessionId}/events
     {"event":"COMPLETED" | "EXPIRED"}
```

System Data forwards this only to the test-profile Stripe fixture control. The
Stripe Gateway signs the stable fixture event and sends it through its normal
webhook verification and Payment provider-event boundary. Replaying the same
terminal event preserves its provider event ID, so durable fulfilment and
expiry idempotency are exercised without browser-direct settlement.

The client also exposes `GET /internal/environments/states` for discovery. It
requires the documented response shape and exact scenario, and accepts only a
`SUCCESS` operation. It sends `X-System-Data-Key` and a non-sensitive stable
`X-E2E-Run-Id`. Request bodies are deterministic within a scenario/run. There
is no automatic mutation retry: system-data operations are idempotent, so a
failed run is recovered through the same prepare/reset lifecycle.

Preparation failure triggers a best-effort reset and preserves the preparation
error. Reset runs after successful and failed browser journeys. If both the
journey and reset fail, the journey remains the reported failure and a generic
cleanup warning is attached. A reset failure after a passing journey fails the
scenario.

## Fail-closed configuration

Stateful runs require runtime-only values:

```text
SYSTEM_DATA_SERVICE_URL=http://localhost:9103
SYSTEM_DATA_INTERNAL_CALLER_KEY=<at-least-32-runtime-characters>
SYSTEM_DATA_TIMEOUT_MS=10000
```

The URL may be plain HTTP loopback on port 8103/9103 or the exact Compose DNS
target `http://system-data-service:8103`. Credentials in URLs, paths, query
strings, fragments, HTTPS, remote/private IPs, other service names and other
ports are rejected before a request. Timeouts are bounded to 1–30 seconds.

Never put the caller key in `.env.example`, GitHub issues, reports, screenshots,
traces or command output. Client errors contain only the operation and safe HTTP
status; response bodies, URLs and keys are not echoed. CI contract tests use a
local deterministic HTTP double and never call system-data or a live provider.

## Stack handoff

The isolated E2E Compose overlay supplies System Data on the approved network,
injects the runtime caller key without committing it, and sets the URL to
`http://system-data-service:8103`. The Stripe payment fixture control requires
exactly the single active Spring profile `test`, explicit FIXTURE mode, an
explicit enable flag, and strong runtime control/signing configuration. Runtime
validation rejects those controls outside the E2E overlay. Tagged stack runs
prove `prepare -> verify -> browser journey -> reset`; service builds,
health/readiness, database persistence and teardown remain Infrastructure
responsibilities.
