#!/usr/bin/env node

const { chmod, readFile, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');

async function main() {
const gatewayUrl = process.env.LIVE_LLM_GATEWAY_URL;
const authorization = process.env.AUTHORIZE_PAID_LLM_VALIDATION;
const outputPath = resolve(
  process.env.LIVE_LLM_VALIDATION_OUTPUT ??
    '/tmp/jsc-live-llm-validation-2026-08-11.json',
);

if (authorization !== 'I AUTHORIZE SIX BOUNDED PAID LLM CALLS') {
  throw new Error('The exact bounded paid-validation authorization is required.');
}
if (!gatewayUrl?.startsWith('http://127.0.0.1:')) {
  throw new Error('LIVE_LLM_GATEWAY_URL must use an explicit loopback address.');
}

const personas = JSON.parse(
  await readFile(
    resolve('../system-data-service/src/main/resources/personas/personas.json'),
    'utf8',
  ),
);
const byId = new Map(personas.map((persona) => [persona.personaId, persona]));

const ordinaryJob = {
  title: 'Software Delivery Coordinator',
  employer: 'Fictional Digital Services Ltd',
  location: 'Manchester, hybrid',
  description:
    'Coordinate delivery plans, communicate with stakeholders, maintain delivery records, analyse risks, support multidisciplinary teams, and improve repeatable processes. Clear written communication and evidence-led prioritisation are essential.',
};
const substantialJob = {
  title: 'Senior Platform Delivery Lead',
  employer: 'Fictional Public Technology Ltd',
  location: 'London, hybrid',
  description:
    'Lead several concurrent platform workstreams; coordinate engineers, product specialists and operational teams; establish delivery controls; manage risks and dependencies; communicate progress to senior stakeholders; improve service reliability; support incident learning; use measurable outcomes; mentor colleagues; and maintain accessible, auditable documentation. The role values cloud delivery, software engineering awareness, data-informed planning, security-conscious decision making, inclusive leadership and continuous improvement.',
};

const cases = [
  ['rich-profile', 'rich-strong-match', ordinaryJob],
  ['typical-profile', 'typical-job', ordinaryJob],
  ['minimal-profile', 'minimal-job', ordinaryJob],
  ['career-changer', 'career-change-job', ordinaryJob],
  ['uploaded-cv-first', 'uploaded-cv-job', ordinaryJob],
  ['stress-profile', 'stress-substantial-job', substantialJob],
];

const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cv: { type: 'string' },
    coverLetter: { type: 'string' },
    groundingNotes: { type: 'array', items: { type: 'string' } },
  },
  required: ['cv', 'coverLetter', 'groundingNotes'],
};

const results = [];
for (const [personaId, caseId, job] of cases) {
  const persona = byId.get(personaId);
  if (!persona) {
    throw new Error(`Missing canonical persona ${personaId}.`);
  }
  const request = {
    contractVersion: '2.0',
    task: 'CV_COVER_LETTER_GENERATION',
    trustedInstructions:
      'Create a concise tailored CV draft and cover letter. Use only facts explicitly present in the candidate JSON. Never invent qualifications, employers, dates, responsibilities, achievements, technologies or years of experience. For sparse evidence, use restrained wording and state limitations in groundingNotes. Keep the CV under 700 words and the cover letter under 450 words.',
    untrustedInput: JSON.stringify({
      candidate: persona.profile,
      candidateContext: {
        personaId,
        journeyStyle: persona.journeyStyle,
        purpose: persona.purpose,
      },
      job,
    }),
    output: {
      format: 'JSON_SCHEMA',
      schemaId: 'real-world-validation-output',
      schemaVersion: '1.0',
      jsonSchema,
    },
    limits: { maxOutputTokens: 1600, temperature: 0.2 },
  };

  const started = performance.now();
  const response = await fetch(`${gatewayUrl}/api/v2/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = await response.json();
  const latencyMs = Math.round(performance.now() - started);
  if (!response.ok) {
    throw new Error(`${caseId} failed with HTTP ${response.status}: ${body.error ?? 'unknown error'}`);
  }
  results.push({
    caseId,
    personaId,
    job,
    latencyMs,
    finishReason: body.finishReason,
    usage: body.usage,
    audit: body.audit,
    generated: JSON.parse(body.output),
  });
  process.stdout.write(
    `${caseId}: ${body.usage.inputTokens} input, ${body.usage.outputTokens} output, ${latencyMs} ms, ${body.audit.estimatedCostMicroUsd} micro-USD\n`,
  );
}

const totals = results.reduce(
  (value, result) => ({
    calls: value.calls + 1,
    inputTokens: value.inputTokens + result.usage.inputTokens,
    outputTokens: value.outputTokens + result.usage.outputTokens,
    totalTokens: value.totalTokens + result.usage.totalTokens,
    estimatedCostMicroUsd:
      value.estimatedCostMicroUsd + result.audit.estimatedCostMicroUsd,
    latencyMs: value.latencyMs + result.latencyMs,
  }),
  {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostMicroUsd: 0,
    latencyMs: 0,
  },
);

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      classification: 'SYNTHETIC_LIVE_VALIDATION_NOT_FOR_COMMIT',
      gatewayUrl,
      totals,
      results,
    },
    null,
    2,
  )}\n`,
  { encoding: 'utf8', mode: 0o600 },
);
await chmod(outputPath, 0o600);

process.stdout.write(
  `TOTAL: ${totals.calls} calls, ${totals.totalTokens} tokens, ${totals.estimatedCostMicroUsd} micro-USD; private evidence ${outputPath}\n`,
);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
