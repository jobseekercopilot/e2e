# Minimum user-management beta stack

`compose.beta.yml` is the only Compose definition approved here as beta-path
evidence. It runs nine components: the client, user-management gateway,
authentication service and PostgreSQL, profile service and PostgreSQL,
location gateway, postcode gateway, and system-data service. It does not start
jobs, documents, applications, payments, AI providers, or any production
infrastructure.

## Source ownership and revisions

Each application build context must be a clean private clone of the expected
`jobseekercopilot/*` repository at the exact commit in
`config/beta-stack-sources.json`. The preparation command rejects a dirty
worktree, a different origin, or another revision. Override conventional
sibling paths with the corresponding `*_REPOSITORY` environment variable.

## Local run

Prerequisites are Node 24.18.0 or a newer Node 24 LTS patch, npm, Java 17/Maven
for the six JVM builds, Docker with Compose v2, and enough capacity for nine
containers (allow roughly 8 GB RAM and 12 GB free disk while building).

```bash
npm ci
npm run playwright:install
npm run stack:prepare
npm run stack:config
npm run stack:build
npm run stack:scan-images
npm run stack:verify
```

`stack:prepare` creates new RSA keys, database passwords, a gateway-to-auth
service token, an inbound system-data key and a distinct downstream
environment-data token in ignored `.runtime/beta-stack.env` mode `0600`.
Nothing from that file is committed or uploaded. `stack:build` runs clean Maven
verification for JVM repositories whose Dockerfiles consume verified JARs,
then builds every Compose image without using prior Docker layers. This makes
an exact source-revision change observable in the resulting image instead of
allowing an older local application layer or tag to survive validation.

`stack:verify` removes only the fixed `jsc-user-management-beta` local volumes,
starts the stack with readiness checks, runs the tagged registration, login,
profile and fixture-backed postcode browser smoke journeys, recreates the two
bounded database volumes, then runs the tagged keyboard/axe/resilient-UX
accessibility path. This profile boundary is required because public
registration assigns a random account ID that the deterministic named-state
reset cannot address. The command then proves a bounded 503 or 504 when the
postcode dependency is stopped, restores it, and removes the containers and
volumes in a `finally` path. On failure it prints the last 200 container log
lines before teardown. It never targets a remote Docker context, production
profile, live provider, or user dataset.

Both databases use one local derivative of the digest-pinned PostgreSQL image.
It removes the root-switching `gosu` helper and declares the existing
unprivileged `postgres` account as the runtime user. The official entrypoint
therefore never needs privilege switching. Database initialization, Flyway,
readiness and browser tests verify that this restriction remains functional.

`stack:scan-images` requires the local Unix Docker socket, enumerates exactly
the eight distinct images used by the nine-component stack, and scans each
with pinned Trivy 0.72.0. It fails on every fixed Critical or High OS or
application-library finding. The advisory cache is stored only in the local
`jsc-e2e-trivy-cache` Docker volume; reports are not written to the repository.

Individual diagnostic commands are available:

```bash
npm run stack:up
npm run stack:smoke
npm run stack:accessibility
npm run stack:dependency-failure
npm run stack:logs
npm run stack:reset
npm run stack:down
```

`stack:reset` and `stack:down` require the exact private runtime file, project
name, local guard value and permissions before deleting the two explicitly
named beta-stack volumes. The registration named state currently removes its
deterministic fixture identity, while public registration creates a random
account ID; therefore the complete verification command recreates the
ephemeral schemas before each stateful browser profile and removes them
afterward. No database is accessed directly by E2E code.

## Ports and troubleshooting

All published ports bind to loopback only:

| Component | Host port |
|---|---:|
| Client | 3100 |
| Location gateway | 9081 |
| Postcode gateway | 9082 |
| User-management gateway | 9083 |
| Authentication service | 9084 |
| Profile service | 9085 |
| System-data service | 9103 |

If preparation rejects a source, fetch that private repository and check out
the exact listed revision with a clean worktree. If readiness fails, use
`npm run stack:logs`; do not bypass a failed health check. If an interrupted run
leaves resources behind, `npm run stack:down` is the bounded recovery command.
