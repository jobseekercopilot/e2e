import type { ExecutionProfile } from './config-policy';
import type { NamedState } from './system-data';

interface PreservationConfiguration {
  enabled: boolean;
  profile: ExecutionProfile;
  liveProfile?: string;
  allowAiGeneration: boolean;
}

interface PreservationScenario extends PreservationConfiguration {
  state?: NamedState;
  tags: string[];
  scenarioPassed: boolean;
  teardownSucceeded: boolean;
}

export function validatePreservationConfiguration(
  configuration: PreservationConfiguration
): boolean {
  if (!configuration.enabled) return false;
  if (
    configuration.profile !== 'e2e'
    || configuration.liveProfile !== 'stabilisation'
    || !configuration.allowAiGeneration
  ) {
    throw new Error(
      'DEMO_READY preservation is restricted to the live stabilisation checkpoint with ALLOW_AI_GENERATION=true.'
    );
  }
  return true;
}

export function shouldPreserveDemoReady(scenario: PreservationScenario): boolean {
  if (!validatePreservationConfiguration(scenario)) return false;
  if (!scenario.scenarioPassed || !scenario.teardownSucceeded) return false;
  if (!scenario.tags.includes('@stabilisation-live')) return false;
  if (scenario.state !== 'DEMO_READY') {
    throw new Error('The live stabilisation checkpoint may preserve only DEMO_READY.');
  }
  return true;
}
