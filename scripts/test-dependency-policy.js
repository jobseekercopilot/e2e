const assert = require('node:assert/strict');
const { evaluatePolicy } = require('./dependency-policy');

const TODAY = '2026-07-26';

function report(findings = {}) {
  return {
    vulnerabilities: Object.fromEntries(
      Object.entries(findings).map(([name, severity]) => [name, { name, severity }]),
    ),
  };
}

function policy(overrides = {}) {
  return {
    schemaVersion: 1,
    failOn: ['critical', 'high'],
    acceptedFindings: [],
    reviewedResidualRisk: {
      moderate: [],
      reviewedAt: TODAY,
      notes: 'Test policy',
    },
    ...overrides,
  };
}

assert.deepEqual(evaluatePolicy(report(), policy(), TODAY), {
  info: 0,
  low: 0,
  moderate: 0,
  high: 0,
  critical: 0,
});

assert.throws(
  () => evaluatePolicy(report({ glob: 'high' }), policy(), TODAY),
  /Unaccepted high findings: glob/,
);

assert.throws(
  () => evaluatePolicy(report({ uuid: 'moderate' }), policy(), TODAY),
  /Unreviewed Moderate findings: uuid/,
);

assert.equal(
  evaluatePolicy(
    report({ uuid: 'moderate' }),
    policy({
      reviewedResidualRisk: {
        moderate: ['uuid'],
        reviewedAt: TODAY,
        notes: 'Accepted until the supported parent release is available',
      },
    }),
    TODAY,
  ).moderate,
  1,
);

assert.equal(
  evaluatePolicy(
    report({ glob: 'high' }),
    policy({
      acceptedFindings: [
        {
          package: 'glob',
          severity: 'high',
          justification: 'Temporary bounded exception',
          owner: 'E2E maintainers',
          expires: '2026-07-27',
        },
      ],
    }),
    TODAY,
  ).high,
  1,
);

assert.throws(
  () =>
    evaluatePolicy(
      report({ glob: 'high' }),
      policy({
        acceptedFindings: [
          {
            package: 'glob',
            severity: 'high',
            justification: 'Expired exception',
            owner: 'E2E maintainers',
            expires: '2026-07-25',
          },
        ],
      }),
      TODAY,
    ),
  /expired/,
);

assert.throws(
  () =>
    evaluatePolicy(
      report(),
      policy({
        acceptedFindings: [
          {
            package: 'glob',
            severity: 'high',
            justification: 'Stale exception',
            owner: 'E2E maintainers',
            expires: '2026-07-27',
          },
        ],
      }),
      TODAY,
    ),
  /stale or does not match/,
);

process.stdout.write('Dependency policy tests passed\n');
