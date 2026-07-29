const common = {
  requireModule: ['ts-node/register'],
  require: ['support/**/*.ts', 'steps/**/*.ts'],
  timeout: 120000,
  // Cucumber 13 treats any positive value as worker-process mode. Sequential
  // execution preserves shared browser/state lifecycle and exits cleanly when
  // a profile intentionally has no scenarios yet.
  parallel: 0
};

const betaFormat = ['progress'];

module.exports = {
  default: {
    ...common,
    tags: '@demo',
    format: ['progress']
  },
  demo: {
    ...common,
    tags: '@demo',
    format: [
      'progress',
      'html:reports/demo/cucumber-report.html',
      'json:reports/demo/cucumber-report.json'
    ]
  },
  smoke: { ...common, tags: '@smoke and not @demo', format: betaFormat },
  e2e: {
    ...common,
    tags: '@e2e and not @demo and not @smoke and not @security and not @provider-failure and not @accessibility and not @stabilisation',
    format: betaFormat
  },
  stabilisation: {
    ...common,
    tags: '@e2e and @stabilisation-live',
    format: betaFormat
  },
  stabilisationUi: {
    ...common,
    tags: '@e2e and @stabilisation-ui',
    format: betaFormat
  },
  stabilisationStale: {
    ...common,
    tags: '@e2e and @stabilisation-stale',
    format: betaFormat
  },
  stabilisationProbe: {
    ...common,
    tags: '@e2e and @stabilisation-probe',
    format: betaFormat
  },
  stabilisationCancellation: {
    ...common,
    tags: '@e2e and @stabilisation-cancellation',
    format: betaFormat
  },
  security: { ...common, tags: '@security and not @demo', format: betaFormat },
  providerFailure: { ...common, tags: '@provider-failure and not @demo', format: betaFormat },
  accessibility: { ...common, tags: '@accessibility and not @demo', format: betaFormat }
};
