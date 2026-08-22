import path from 'node:path';

export const knownProfiles = ['demo', 'smoke', 'e2e', 'security', 'provider-failure', 'accessibility'] as const;
export type ExecutionProfile = typeof knownProfiles[number];

export function readProfile(value = 'demo'): ExecutionProfile {
  if (!knownProfiles.includes(value as ExecutionProfile)) {
    throw new Error(`Unsupported E2E_PROFILE: ${value}`);
  }
  return value as ExecutionProfile;
}

export function assertRelativeArtifactPath(name: string, value: string, requiredRoot?: string): string {
  const canonical = value.replaceAll('\\', '/');
  if (path.isAbsolute(value) || canonical.split('/').includes('..')) {
    throw new Error(`${name} must be a repository-relative path without traversal.`);
  }
  if (requiredRoot && canonical !== requiredRoot && !canonical.startsWith(`${requiredRoot}/`)) {
    throw new Error(`${name} must stay under ${requiredRoot}/.`);
  }
  return canonical;
}

export function validateSessionPolicy(
  profile: ExecutionProfile,
  demoMode: boolean,
  useSavedSession: boolean,
  saveDemoSession: boolean
): void {
  if (profile !== 'demo' && (demoMode || useSavedSession || saveDemoSession)) {
    throw new Error('Beta profiles cannot enable demo mode or reusable browser sessions.');
  }
  if ((useSavedSession || saveDemoSession) && !demoMode) {
    throw new Error('Reusable browser sessions are allowed only in explicit demo mode.');
  }
}
