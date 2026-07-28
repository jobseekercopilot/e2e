import {
  clearFixtureAccountEmails,
  fixtureAccountEmailExists
} from '../pages/PasswordRecoveryPage';
import type { E2EConfig } from './config';
import { LocalStackSesCapture } from './localstack-ses';

export async function clearAccountEmailCapture(config: E2EConfig): Promise<void> {
  if (config.accountEmailMode === 'local-ses') {
    await new LocalStackSesCapture(config.localStackSesUrl).clear();
    return;
  }
  await clearFixtureAccountEmails(
    config.authenticationFixtureUrl,
    config.environmentDataToken
  );
}

export async function accountEmailExists(
  config: E2EConfig,
  recipient: string,
  purpose: 'PASSWORD_RESET' | 'PASSWORD_CHANGED'
): Promise<boolean> {
  if (config.accountEmailMode === 'local-ses') {
    const subject = purpose === 'PASSWORD_RESET'
      ? 'Reset your Job Seeker Copilot password'
      : 'Your Job Seeker Copilot password was changed';
    const messages = await new LocalStackSesCapture(config.localStackSesUrl).messages();
    return messages.some(message =>
      message.Subject === subject
      && message.Destination.ToAddresses.some(address =>
        address.toLowerCase() === recipient.toLowerCase()
      )
    );
  }
  return fixtureAccountEmailExists(
    config.authenticationFixtureUrl,
    config.environmentDataToken,
    recipient,
    purpose
  );
}
