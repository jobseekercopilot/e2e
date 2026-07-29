#!/usr/bin/env node
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateLiveStabilisation } = require('./live-stabilisation-policy');

const CHECKPOINT_PHASES = ['ui', 'stale', 'checkpoint'];

function phaseEnvironment(mode, environment) {
  const zeroCreditMode = mode === 'ui' || mode === 'stale';
  const preservationDisabled = zeroCreditMode || mode === 'probe';
  return {
    ...environment,
    ALLOW_AI_GENERATION: zeroCreditMode
      ? 'false'
      : environment.ALLOW_AI_GENERATION,
    ALLOW_SINGLE_GENERATION_PROBE: mode === 'probe'
      ? environment.ALLOW_SINGLE_GENERATION_PROBE
      : 'false',
    PRESERVE_DEMO_READY_AFTER_RUN: preservationDisabled
      ? 'false'
      : environment.PRESERVE_DEMO_READY_AFTER_RUN,
  };
}

function runLiveStabilisation(mode, environment, dependencies = {}) {
  const validate = dependencies.validateLiveStabilisation
    || validateLiveStabilisation;
  const spawn = dependencies.spawnSync || spawnSync;
  const reportError = dependencies.reportError || console.error;

  try {
    validate(mode, environment);
  } catch (error) {
    reportError(
      error instanceof Error
        ? error.message
        : 'Live stabilisation preflight failed.'
    );
    return 1;
  }

  const phases = mode === 'checkpoint' ? CHECKPOINT_PHASES : [mode];
  const cucumber = path.resolve(
    __dirname,
    '../node_modules/@cucumber/cucumber/bin/cucumber.js'
  );
  for (const phase of phases) {
    const childEnvironment = phaseEnvironment(phase, environment);
    let policy;
    try {
      policy = validate(phase, childEnvironment);
    } catch (error) {
      reportError(
        error instanceof Error
          ? error.message
          : 'Live stabilisation phase preflight failed.'
      );
      return 1;
    }

    const result = spawn(
      process.execPath,
      [cucumber, '--profile', policy.profile],
      {
        cwd: path.resolve(__dirname, '..'),
        env: {
          ...childEnvironment,
          E2E_PROFILE: 'e2e',
          LIVE_STABILISATION_PROFILE: policy.profile,
          E2E_BASE_URL: policy.baseUrl,
          SYSTEM_DATA_SERVICE_URL: policy.systemDataUrl,
          DEMO_MODE: 'false',
          USE_SAVED_SESSION: 'false',
          SAVE_DEMO_SESSION: 'false',
          RECORD_VIDEO: 'false',
          ARTIFACT_DIR: 'test-results/stabilisation/failures',
          STABILISATION_ARTIFACT_DIR:
            environment.STABILISATION_ARTIFACT_DIR
            || 'test-results/stabilisation',
        },
        stdio: 'inherit',
      }
    );

    if (result.error) {
      reportError('Unable to launch the live stabilisation Cucumber profile.');
      return 1;
    }
    const status = result.status ?? 1;
    if (status !== 0) {
      if (mode === 'checkpoint' && phase !== 'checkpoint') {
        reportError(
          `The ${phase} prerequisite failed. Paid live generation was not started.`
        );
      }
      return status;
    }
  }
  return 0;
}

if (require.main === module) {
  process.exit(
    runLiveStabilisation(
      process.argv[2] || 'checkpoint',
      process.env
    )
  );
}

module.exports = {
  CHECKPOINT_PHASES,
  phaseEnvironment,
  runLiveStabilisation
};
