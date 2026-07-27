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
PROVIDER_FAILURE
DEMO_READY
```

`PROVIDER_FAILURE` is accepted only by the provider-failure profile.
`DEMO_READY` is accepted only by the demo and full E2E profiles, and other
states are not accepted for demo lifecycle automation. The `@framework` smoke
is deliberately stateless and does not contact system-data.

## Runtime contract

For a stateful scenario the hooks execute:

```text
GET  /internal/environments/states/{scenario}
POST /internal/environments/prepare       {"scenario":"<NAME>"}
GET  /internal/environments/verify?scenario=<NAME>
browser journey
POST /internal/environments/reset         {"scenario":"<NAME>"}
```

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

## Minimum-stack handoff

E2E-03 must supply system-data on the approved Compose network, inject the
runtime caller key without committing it, set the URL to
`http://system-data-service:8103`, and run a tagged smoke that proves actual
`prepare -> verify -> browser journey -> reset`. That issue owns service builds,
health/readiness, database persistence and teardown; this client remains the
only E2E state-preparation integration.
