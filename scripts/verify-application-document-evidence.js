const fs = require('node:fs');
const path = require('node:path');

const requiredIds = [
  'add-neither', 'add-cv-only', 'add-cover-only', 'add-both',
  'generate-cv-only', 'generate-cover-only', 'generate-both',
  'mixed-generated-cv-uploaded-cover', 'mixed-uploaded-cv-generated-cover',
  'generation-failure-then-upload-or-omit', 'upload-zero-credit',
  'selected-generation-credit', 'valid-pdf-docx', 'image-only-no-text',
  'spoofed-malformed-oversized', 'unsafe-pdf-docx', 'scanner-verdicts',
  'extraction-states', 'owner-isolation', 'idempotency-and-conflict',
  'exact-freeze-and-newer-version', 'deletion-tombstone-cleanup',
  'redaction-and-download-headers', 'synthetic-offline-only'
];
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/application-document-evidence.json'), 'utf8'));
const errors = [];

if (manifest.schemaVersion !== 1) errors.push('schemaVersion must be 1');
if (!Array.isArray(manifest.cases)) errors.push('cases must be an array');
const ids = new Set();
for (const evidenceCase of manifest.cases ?? []) {
  if (!requiredIds.includes(evidenceCase.id)) errors.push(`unknown case: ${evidenceCase.id}`);
  if (ids.has(evidenceCase.id)) errors.push(`duplicate case: ${evidenceCase.id}`);
  ids.add(evidenceCase.id);
  if (!Array.isArray(evidenceCase.sources) || evidenceCase.sources.length === 0) {
    errors.push(`${evidenceCase.id}: at least one source is required`);
    continue;
  }
  for (const source of evidenceCase.sources) {
    if (!Array.isArray(source.assertions) || source.assertions.some(value => typeof value !== 'string' || !value.trim())) {
      errors.push(`${evidenceCase.id}: source assertions must be non-empty strings`);
    }
    if (source.kind === 'local-e2e') {
      const resolved = path.resolve(root, source.path ?? '');
      if (!resolved.startsWith(`${root}${path.sep}`) || !fs.existsSync(resolved)) {
        errors.push(`${evidenceCase.id}: local source does not exist: ${source.path}`);
      }
    } else if (source.kind === 'repository-test') {
      if (![source.repository, source.revision, source.path].every(value => typeof value === 'string' && value.trim())) {
        errors.push(`${evidenceCase.id}: repository source requires repository, revision and path`);
      }
      if (!(/^src\/test\//.test(source.path ?? '') || /\.spec\.ts$/.test(source.path ?? ''))) {
        errors.push(`${evidenceCase.id}: repository source must name an executable test path`);
      }
    } else {
      errors.push(`${evidenceCase.id}: unsupported source kind: ${source.kind}`);
    }
  }
}
for (const id of requiredIds) if (!ids.has(id)) errors.push(`missing case: ${id}`);
if (ids.size !== requiredIds.length) errors.push(`expected exactly ${requiredIds.length} cases`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`application-document evidence policy: ${requiredIds.length} acceptance cases are source-backed`);
