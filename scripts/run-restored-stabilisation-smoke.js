#!/usr/bin/env node
require('ts-node/register');

const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { StabilisationPage } = require('../pages/StabilisationPage');
const {
  validateRestoredPersistenceSmoke
} = require('./live-stabilisation-policy');
const {
  installGenerationStartBlocker
} = require('../support/stabilisation-runtime-safety');

function requireManifest(value) {
  if (
    !value
    || value.version !== 2
    || typeof value.runId !== 'string'
    || !Array.isArray(value.jobs)
    || value.jobs.length !== 5
  ) {
    throw new Error('The restored-runtime persistence manifest contract is invalid.');
  }
  const jobs = value.jobs;
  for (const job of jobs) {
    if (
      !job
      || typeof job.canonicalJobId !== 'string'
      || !/^[A-Za-z0-9._:-]{1,128}$/.test(job.canonicalJobId)
      || typeof job.provider !== 'string'
      || !job.provider.trim()
      || typeof job.providerJobId !== 'string'
      || !job.providerJobId.trim()
      || typeof job.applicationId !== 'string'
      || !job.applicationId.trim()
      || typeof job.cvDocumentId !== 'string'
      || !job.cvDocumentId.trim()
      || typeof job.coverLetterDocumentId !== 'string'
      || !job.coverLetterDocumentId.trim()
      || typeof job.title !== 'string'
      || !job.title.trim()
      || typeof job.company !== 'string'
      || !job.company.trim()
      || !['Software Engineer', 'Software Developer'].includes(job.role)
      || !Number.isSafeInteger(job.page)
      || job.page < 1
      || job.page > 20
      || !Array.isArray(job.requirementTerms)
      || job.requirementTerms.length < 1
      || job.requirementTerms.length > 12
      || job.requirementTerms.some(term =>
        typeof term !== 'string' || !term.trim() || term.length > 64
      )
    ) {
      throw new Error('The restored-runtime persistence manifest contains an invalid job.');
    }
  }
  const distinct = new Set(jobs.map(job => job.canonicalJobId));
  if (distinct.size !== 5) {
    throw new Error('The restored-runtime persistence manifest jobs must be distinct.');
  }
  return jobs;
}

async function main() {
  const policy = validateRestoredPersistenceSmoke(process.env);
  const repositoryRoot = path.resolve(__dirname, '..');
  const manifestPath = path.resolve(repositoryRoot, policy.manifest);
  const jobs = requireManifest(
    JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  );
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      baseURL: policy.baseUrl,
      viewport: { width: 1920, height: 1080 }
    });
    const generationStartBlocker = await installGenerationStartBlocker(
      context,
      'restored-runtime read-only firewall'
    );
    try {
      const page = await context.newPage();
      const restoredRuntime = new StabilisationPage(
        page,
        policy.baseUrl,
        'restored-runtime-smoke',
        policy.artifactDirectory,
        policy.manifest
      );
      await restoredRuntime.verifyRestoredRuntimePersistence(jobs);
    } finally {
      try {
        generationStartBlocker.assertNoAttempts();
      } finally {
        try {
          await generationStartBlocker.stop();
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(
    'Restored-runtime persistence smoke passed; artifacts are under test-results/stabilisation.'
  );
}

main().catch(error => {
  console.error(
    error instanceof Error
      ? error.message
      : 'The restored-runtime persistence smoke failed.'
  );
  process.exit(1);
});
