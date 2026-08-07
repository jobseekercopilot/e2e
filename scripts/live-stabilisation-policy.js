const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const MANIFEST_DEFAULT =
  'test-results/stabilisation/preserved-live-manifest.json';

function enabled(value) {
  return typeof value === 'string'
    && ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
}

function requireLoopbackApplication(value) {
  const url = new URL(value || 'http://localhost:3100');
  const valid = url.protocol === 'http:'
    && LOOPBACK_HOSTS.has(url.hostname)
    && !url.username
    && !url.password
    && !url.search
    && !url.hash
    && (url.pathname === '/' || url.pathname === '');
  if (!valid) {
    throw new Error('Live stabilisation must target a local HTTP application URL.');
  }
  return url.origin;
}

function requireLoopbackSystemData(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('System Data must use a bounded local HTTP origin.');
  }
  const valid = url.protocol === 'http:'
    && LOOPBACK_HOSTS.has(url.hostname)
    && ['8103', '9103'].includes(url.port)
    && !url.username
    && !url.password
    && !url.search
    && !url.hash
    && (url.pathname === '/' || url.pathname === '');
  if (!valid) {
    throw new Error('System Data must use HTTP loopback on port 8103 or 9103.');
  }
  return url.origin;
}

function requirePersistenceManifest(value = MANIFEST_DEFAULT) {
  const normalised = value.replaceAll('\\', '/');
  const valid = !normalised.startsWith('/')
    && normalised.startsWith('test-results/stabilisation/')
    && normalised.endsWith('.json')
    && !normalised.split('/').includes('..');
  if (!valid) {
    throw new Error(
      'The restored-runtime manifest must be a JSON file under test-results/stabilisation.'
    );
  }
  return normalised;
}

function requireStabilisationArtifactDirectory(
  value = 'test-results/stabilisation'
) {
  const normalised = value.replaceAll('\\', '/').replace(/\/+$/, '');
  const valid = !normalised.startsWith('/')
    && (
      normalised === 'test-results/stabilisation'
      || normalised.startsWith('test-results/stabilisation/')
    )
    && !normalised.split('/').includes('..');
  if (!valid) {
    throw new Error(
      'Stabilisation artifacts must stay under test-results/stabilisation.'
    );
  }
  return normalised;
}

function validateLiveStabilisation(mode, environment) {
  if (!['checkpoint', 'ui', 'stale', 'probe', 'cancellation'].includes(mode)) {
    throw new Error(
      'Live stabilisation mode must be checkpoint, ui, stale, probe or cancellation.'
    );
  }
  const baseUrl = requireLoopbackApplication(
    environment.E2E_BASE_URL || environment.BASE_URL
  );
  if (!environment.SYSTEM_DATA_SERVICE_URL || !environment.SYSTEM_DATA_INTERNAL_CALLER_KEY) {
    throw new Error(
      'Live stabilisation requires the bounded System Data lifecycle configuration.'
    );
  }
  const systemDataUrl = requireLoopbackSystemData(environment.SYSTEM_DATA_SERVICE_URL);
  if (!enabled(environment.ALLOW_REAL_PROVIDER_E2E)) {
    throw new Error(
      'Live job-provider use is disabled. Set ALLOW_REAL_PROVIDER_E2E=true explicitly.'
    );
  }
  const allowAiGeneration = enabled(environment.ALLOW_AI_GENERATION);
  if (['ui', 'stale'].includes(mode) && allowAiGeneration) {
    throw new Error(
      'The UI and stale-response stabilisation modes are zero-credit and require ALLOW_AI_GENERATION=false.'
    );
  }
  if (!['ui', 'stale'].includes(mode) && !allowAiGeneration) {
    throw new Error(
      'Live OpenAI use is disabled. Set ALLOW_AI_GENERATION=true explicitly.'
    );
  }
  if (mode === 'probe' && !enabled(environment.ALLOW_SINGLE_GENERATION_PROBE)) {
    throw new Error(
      'The single-generation probe is disabled. Set ALLOW_SINGLE_GENERATION_PROBE=true explicitly.'
    );
  }
  if (mode === 'cancellation' && !enabled(environment.ALLOW_CANCELLATION_E2E)) {
    throw new Error(
      'Cancellation is disabled. Set ALLOW_CANCELLATION_E2E=true explicitly.'
    );
  }
  const preserveDemoReady = enabled(environment.PRESERVE_DEMO_READY_AFTER_RUN);
  if (preserveDemoReady && mode !== 'checkpoint') {
    throw new Error(
      'DEMO_READY preservation is available only to the live stabilisation checkpoint.'
    );
  }
  return {
    baseUrl,
    systemDataUrl,
    preserveDemoReady,
    profile: mode === 'ui'
      ? 'stabilisationUi'
      : mode === 'stale'
        ? 'stabilisationStale'
        : mode === 'probe'
          ? 'stabilisationProbe'
          : mode === 'cancellation'
            ? 'stabilisationCancellation'
            : 'stabilisation'
  };
}

function validateRestoredPersistenceSmoke(environment) {
  if (!enabled(environment.ALLOW_RESTORED_PERSISTENCE_SMOKE)) {
    throw new Error(
      'The restored-runtime persistence smoke must be explicitly authorised.'
    );
  }
  if (!enabled(environment.RESTORED_RUNTIME_CONFIRMED)) {
    throw new Error(
      'Confirm the exact locked runtime before the standalone persistence smoke.'
    );
  }
  return {
    baseUrl: requireLoopbackApplication(
      environment.E2E_BASE_URL || environment.BASE_URL
    ),
    manifest: requirePersistenceManifest(environment.STABILISATION_MANIFEST),
    artifactDirectory: requireStabilisationArtifactDirectory(
      environment.STABILISATION_ARTIFACT_DIR
    )
  };
}

module.exports = {
  enabled,
  requireLoopbackApplication,
  requireLoopbackSystemData,
  requirePersistenceManifest,
  requireStabilisationArtifactDirectory,
  validateRestoredPersistenceSmoke,
  validateLiveStabilisation
};
