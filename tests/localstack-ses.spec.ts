import { expect, test } from '@playwright/test';
import {
  extractResetLink,
  LocalStackSesCapture,
  type LocalStackSesMessage
} from '../support/localstack-ses';

const resetLink =
  'http://localhost:3100/reset-password#token=' + 'A'.repeat(43);

const message: LocalStackSesMessage = {
  Source: 'accounts@jobseekercopilot.com',
  Destination: { ToAddresses: ['claimant@example.test'] },
  Subject: 'Reset your Job Seeker Copilot password',
  Body: {
    text_part: `Reset your password: ${resetLink}`,
    html_part: `<a href="${resetLink}">Reset your password</a>`
  }
};

test('LocalStack capture is bounded to the loopback gateway', () => {
  expect(() => new LocalStackSesCapture('https://email.eu-west-2.amazonaws.com'))
    .toThrow('LOCALSTACK_SES_URL must be bounded');
  expect(() => new LocalStackSesCapture('http://localstack:4566'))
    .toThrow('LOCALSTACK_SES_URL must be bounded');
  expect(() => new LocalStackSesCapture('http://127.0.0.1:4566'))
    .not.toThrow();
});

test('LocalStack capture clears, reads and extracts without application routing', async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const fetcher = async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    requests.push({
      url: input.toString(),
      method: init?.method ?? 'GET'
    });
    if (init?.method === 'DELETE') {
      return new Response(undefined, { status: 200 });
    }
    return new Response(JSON.stringify({ messages: [message] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  const capture = new LocalStackSesCapture(
    'http://127.0.0.1:4566',
    fetcher
  );

  await capture.clear();
  expect(await capture.countFor('claimant@example.test')).toBe(1);
  expect((await capture.waitFor(
    'claimant@example.test',
    'Reset your Job Seeker Copilot password',
    50
  )).Subject).toBe(message.Subject);
  expect(extractResetLink(message)).toBe(resetLink);
  expect(requests).toEqual([
    { url: 'http://127.0.0.1:4566/_aws/ses', method: 'DELETE' },
    { url: 'http://127.0.0.1:4566/_aws/ses', method: 'GET' },
    { url: 'http://127.0.0.1:4566/_aws/ses', method: 'GET' }
  ]);
});

test('LocalStack capture errors never include captured message data', async () => {
  const capturedValue = 'sensitive-reset-token-value';
  const fetcher = async (): Promise<Response> =>
    new Response(JSON.stringify({ unexpected: capturedValue }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  const capture = new LocalStackSesCapture(
    'http://127.0.0.1:4566',
    fetcher
  );

  let errorMessage = '';
  try {
    await capture.messages();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  expect(errorMessage).not.toContain(capturedValue);
  expect(errorMessage).toContain('unexpected message shape');
});
