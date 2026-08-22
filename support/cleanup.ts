import { isSyntheticEmail } from './synthetic-data';

export interface CleanupConfig {
  enabled: boolean;
  baseUrl?: string;
  token?: string;
  profile: string;
}

export type FetchLike = typeof fetch;

function loopbackUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('Synthetic cleanup is restricted to local HTTP loopback endpoints.');
  }
  return url;
}

export async function cleanupSyntheticUser(email: string, config: CleanupConfig, fetchImpl: FetchLike = fetch): Promise<void> {
  if (!isSyntheticEmail(email)) {
    throw new Error('Refusing to clean up an identity outside the reserved synthetic namespace.');
  }
  if (config.profile === 'demo') {
    throw new Error('Automated cleanup is not available to demo profiles.');
  }
  if (!config.enabled || !config.baseUrl) {
    throw new Error('Synthetic user cleanup must be explicitly enabled and configured for beta journeys.');
  }

  const baseUrl = loopbackUrl(config.baseUrl);
  const cleanupUrl = new URL('/internal/test-support/users/cleanup', baseUrl);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (config.token) headers.authorization = `Bearer ${config.token}`;

  const response = await fetchImpl(cleanupUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email })
  });
  if (!response.ok) {
    throw new Error(`Synthetic cleanup failed with HTTP ${response.status}.`);
  }
}
