export interface LocalStackSesMessage {
  Source: string;
  Destination: {
    ToAddresses: string[];
  };
  Subject: string;
  Body: {
    text_part: string;
    html_part: string;
  };
}

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export class LocalStackSesCapture {
  private readonly endpoint: URL;

  constructor(
    baseUrl: string | undefined,
    private readonly fetcher: Fetcher = globalThis.fetch
  ) {
    this.endpoint = validateLocalStackSesUrl(baseUrl);
  }

  async clear(): Promise<void> {
    const response = await this.fetcher(this.endpoint, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`LocalStack SES cleanup failed with HTTP ${response.status}.`);
    }
  }

  async messages(): Promise<LocalStackSesMessage[]> {
    const response = await this.fetcher(this.endpoint);
    if (!response.ok) {
      throw new Error(`LocalStack SES lookup failed with HTTP ${response.status}.`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('LocalStack SES lookup returned invalid JSON.');
    }
    if (!isMessageEnvelope(body)) {
      throw new Error('LocalStack SES lookup returned an unexpected message shape.');
    }
    return body.messages;
  }

  async waitFor(
    recipient: string,
    subject: string,
    timeoutMs = 10_000
  ): Promise<LocalStackSesMessage> {
    const deadline = Date.now() + timeoutMs;
    do {
      const message = (await this.messages()).find(candidate =>
        candidate.Subject === subject
        && candidate.Destination.ToAddresses.some(address =>
          address.toLowerCase() === recipient.toLowerCase()
        )
      );
      if (message) return message;
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    throw new Error('Expected LocalStack account email was not captured before timeout.');
  }

  async countFor(recipient: string): Promise<number> {
    return (await this.messages()).filter(message =>
      message.Destination.ToAddresses.some(address =>
        address.toLowerCase() === recipient.toLowerCase()
      )
    ).length;
  }
}

export function extractResetLink(message: LocalStackSesMessage): string {
  const combined = `${message.Body.text_part}\n${message.Body.html_part}`;
  const match = combined.match(
    /https?:\/\/[^\s"'<>]+\/reset-password#token=[A-Za-z0-9_-]{32,128}/
  );
  if (!match) {
    throw new Error('Captured reset email did not contain a bounded reset link.');
  }
  return match[0];
}

function validateLocalStackSesUrl(value: string | undefined): URL {
  if (!value) {
    throw new Error('LOCALSTACK_SES_URL is required in local-ses E2E mode.');
  }
  const base = new URL(value);
  const allowedHost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(base.hostname);
  if (base.protocol !== 'http:' || !allowedHost || base.port !== '4566'
      || base.username || base.password || base.search || base.hash
      || (base.pathname !== '' && base.pathname !== '/')) {
    throw new Error('LOCALSTACK_SES_URL must be bounded to the loopback LocalStack gateway.');
  }
  return new URL('/_aws/ses', base);
}

function isMessageEnvelope(value: unknown): value is { messages: LocalStackSesMessage[] } {
  if (!value || typeof value !== 'object') return false;
  const messages = (value as { messages?: unknown }).messages;
  return Array.isArray(messages) && messages.every(isMessage);
}

function isMessage(value: unknown): value is LocalStackSesMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<LocalStackSesMessage>;
  return typeof message.Source === 'string'
    && typeof message.Subject === 'string'
    && !!message.Destination
    && Array.isArray(message.Destination.ToAddresses)
    && message.Destination.ToAddresses.every(address => typeof address === 'string')
    && !!message.Body
    && typeof message.Body.text_part === 'string'
    && typeof message.Body.html_part === 'string';
}
