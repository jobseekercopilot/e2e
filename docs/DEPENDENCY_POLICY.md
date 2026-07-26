# Runtime and dependency policy

## Supported runtime

The E2E repository uses Node 24 LTS. `.nvmrc` selects `24.18.0`, and
`package.json` accepts that release or a newer Node 24 security patch. Other
major versions are not part of the tested contract.

This decision follows the official Node release schedule: Node 24 (Krypton) is
the current Active LTS line, while Node 26 is Current rather than LTS:

- https://nodejs.org/en/about/previous-releases
- https://nodejs.org/en/blog/release/v24.18.0/

Run `nvm use` before installing or verifying. `npm run verify:runtime` checks
the runtime, `.nvmrc` and package engine range agree.

## Upgrade evidence

On 26 July 2026, a live audit of the previous Cucumber 11.3.0 lock reported
four High and four Moderate findings across Cucumber and its transitive
packages. Cucumber 13.2.0 is a supported release on Node 24 and replaces the
affected tree. The resulting clean lock reports zero known findings. No
`--force`, audit suppression or package override is used.

All Cucumber profiles, dry-run step matching, TypeScript, framework smoke,
accessibility configuration and Playwright support tests remain part of the
verification gate.

## Enforcement

`npm run audit:policy` reads the machine-readable npm audit result and
`config/dependency-policy.json`.

- Unaccepted Critical and High findings fail.
- Every Moderate finding must be named under reviewed residual risk.
- Stale exceptions and stale Moderate entries fail.
- A temporary accepted finding requires package, severity, justification,
  owner and a non-expired date.
- Critical or High exceptions require an explicit risk decision and must be
  tracked as a beta dependency; adding an exception is not itself approval to
  release.

`npm run test:dependency-policy` proves clean, rejected High, reviewed
Moderate, active exception, expired exception and stale exception behaviour.
The current policy has no accepted or residual findings.

Use:

```bash
nvm use
npm ci
npm run verify
```

The audit step requires access to the public npm advisory registry. Local
verification is authoritative while hosted GitHub Actions are intentionally
paused for cost control.
