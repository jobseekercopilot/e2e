# Contributing

Work starts from `develop` and is submitted through one focused `feature/*`
branch and pull request per issue. Do not commit feature work directly to
`develop`, use `main`, force-push, or mix unrelated findings.

```bash
git switch develop
git pull --ff-only origin develop
git switch -c feature/issue-short-description
npm ci
npm run playwright:install
npm run verify
npm audit --audit-level=high
```

Preserve existing demo scenarios. Put beta behavior behind documented tags or
profiles and never create another browser framework. Do not commit recordings,
screenshots, reports, downloads, authentication state, caches, browser binaries,
real `.env` files, credentials or user data.

Third-party code or data requires provenance and licence review. Contributions
are private and proprietary and require authorization plus appropriate
intellectual-property and confidentiality terms.
