import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { expect, type Download, type Page } from '@playwright/test';

type DocumentKind = 'cv' | 'cover-letter';
type DocumentFormat = 'pdf' | 'docx';

export interface StabilisationJobRecord {
  canonicalJobId: string;
  provider: string;
  providerJobId?: string;
  applicationId?: string;
  cvDocumentId?: string;
  coverLetterDocumentId?: string;
  title: string;
  company: string;
  role: string;
  page: number;
  requirementTerms: string[];
}

export interface StabilisationPersistenceManifest {
  version: 2;
  runId: string;
  jobs: StabilisationJobRecord[];
}

export interface DocumentValidationContext {
  jobTitle: string;
  company: string;
  projectTitle: string;
  qualificationTitle: string;
  jobRequirementTerms: string[];
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 256;
const SECTION_HEADINGS = new Set([
  'Technical Profile',
  'Professional Profile',
  'Personal Summary',
  'Projects',
  'Technical Skills',
  'Core Skills',
  'Employment History',
  'Work History',
  'Education and Qualifications',
  'Qualifications',
  'Additional Experience'
]);

function safeSegment(value: string): string {
  const safe = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  if (!safe) throw new Error('A stabilisation artifact name must contain a safe character.');
  return safe;
}

function runLocalTool(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        encoding: 'utf8',
        maxBuffer: MAX_EXTRACTED_TEXT_BYTES,
        timeout: 15_000,
        windowsHide: true,
        env: {
          PATH: process.env.PATH ?? '/usr/bin:/bin',
          LANG: 'C',
          LC_ALL: 'C'
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(
            `${command} could not inspect the generated document: ${
              stderr.trim() || error.message
            }`
          ));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function normaliseText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function occurrenceCount(text: string, value: string): number {
  const haystack = text.replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
  const needle = value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) >= 0) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function expectText(value: string, text: string, message: string): void {
  expect(
    text.replace(/\s+/g, ' ').toLocaleLowerCase('en-GB'),
    message
  ).toContain(value.replace(/\s+/g, ' ').toLocaleLowerCase('en-GB'));
}

export function validateGeneratedDocumentText(
  extractedText: string,
  kind: DocumentKind,
  context: DocumentValidationContext
): void {
  const text = normaliseText(extractedText);
  const evidenceText = normaliseText(
    text
      .split('\n')
      .filter(line => line.trim() !== 'Generated with Job Seeker Copilot')
      .join('\n')
  );
  expect(text.length, `The ${kind} contained no extractable text.`).toBeGreaterThan(100);
  expectText(
    context.jobTitle,
    text,
    `The ${kind} did not identify the selected role.`
  );
  expectText(
    context.projectTitle,
    evidenceText,
    `The ${kind} omitted the selected Project evidence.`
  );
  expectText(
    context.qualificationTitle,
    text,
    `The ${kind} omitted the selected Qualification evidence.`
  );
  expect(
    occurrenceCount(text, context.qualificationTitle),
    `The ${kind} duplicated the selected Qualification evidence.`
  ).toBe(1);
  expect(
    context.jobRequirementTerms.length,
    'The selected job did not expose a bounded requirement term for tailoring.'
  ).toBeGreaterThan(0);
  expect(
    context.jobRequirementTerms.filter(term => occurrenceCount(evidenceText, term) > 0),
    `The ${kind} did not connect the selected evidence to a requirement from the job description.`
  ).not.toEqual([]);

  if (kind === 'cv') {
    expect(text, 'The CV was paired with cover-letter content.')
      .not.toMatch(/\bDear Hiring Manager\b/i);
    expect(
      text,
      'The CV did not contain a professional or technical profile section.'
    ).toMatch(/\b(?:Technical|Professional) Profile\b/i);
    expect(text, 'The CV did not present the selected Project as a Project.')
      .toMatch(/(?:^|\n)Projects(?:\n|$)/i);
    expect(text, 'The CV did not present the selected Qualification once.')
      .toMatch(/(?:^|\n)Education and Qualifications(?:\n|$)/i);
  } else {
    expectText(
      context.company,
      text,
      'The cover letter did not identify the selected company.'
    );
    expectText(
      `Application for ${context.jobTitle} at ${context.company}`,
      text,
      'The cover letter was paired with a different job.'
    );
    expect(text).toMatch(/\bDear Hiring Manager\b/i);
    expect(text).toMatch(/\bYours faithfully\b/i);
    expect(
      text,
      'The cover letter was paired with CV section structure.'
    ).not.toMatch(/(?:^|\n)(?:Technical Skills|Employment History)(?:\n|$)/i);
  }

  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  if (kind === 'cv') {
    const projectHeading = lines.indexOf('Projects');
    const nextHeading = lines.findIndex(
      (line, index) => index > projectHeading && SECTION_HEADINGS.has(line)
    );
    const projectSection = lines
      .slice(projectHeading + 1, nextHeading === -1 ? undefined : nextHeading)
      .join('\n');
    expectText(
      context.projectTitle,
      projectSection,
      'The CV did not present the selected Project inside its Projects section.'
    );
  }
  for (let index = 0; index < lines.length; index += 1) {
    if (!SECTION_HEADINGS.has(lines[index])) continue;
    expect(
      lines[index + 1] && !SECTION_HEADINGS.has(lines[index + 1]),
      `The ${kind} rendered an empty "${lines[index]}" section.`
    ).toBeTruthy();
  }

  const repeatedNarrative = new Map<string, number>();
  for (const line of lines) {
    const candidate = line.replace(/^[•*-]\s*/, '').trim();
    if (candidate.length < 32 || candidate === 'Generated with Job Seeker Copilot') continue;
    const key = candidate.toLocaleLowerCase('en-GB');
    repeatedNarrative.set(key, (repeatedNarrative.get(key) ?? 0) + 1);
  }
  expect(
    Array.from(repeatedNarrative.entries())
      .filter(([, count]) => count > 1)
      .map(([line]) => line),
    `The ${kind} contained duplicated narrative lines.`
  ).toEqual([]);

  const unsupportedClaims = [
    /\b(?:increased|improved|reduced|grew|boosted|saved)\b[^\n]{0,60}\b\d{1,3}%\b/i,
    /\b\d+\+?\s+years(?:'| of)? experience\b/i,
    /\b(?:AWS|Azure|Google Cloud|GCP)[ -]certified\b/i,
    /\b(?:managed|led) (?:a )?team of \d+\b/i,
    /\b(?:revenue|sales|profit) (?:of|by) £?\d/i
  ];
  const searchableText = text.replace(/\s+/g, ' ');
  for (const unsupported of unsupportedClaims) {
    expect(
      searchableText,
      `The ${kind} contained an obvious unsupported quantified or credential claim.`
    ).not.toMatch(unsupported);
  }
}

async function extractDocxText(outputPath: string, bytes: Buffer): Promise<string> {
  expect(bytes.subarray(0, 4), 'The DOCX did not have a ZIP package signature.')
    .toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  expect(
    bytes.subarray(Math.max(0, bytes.length - 65_557)).includes(
      Buffer.from([0x50, 0x4b, 0x05, 0x06])
    ),
    'The DOCX ZIP package did not contain an end-of-central-directory record.'
  ).toBe(true);

  const entries = (await runLocalTool('unzip', ['-Z1', outputPath]))
    .split(/\r?\n/)
    .filter(Boolean);
  expect(entries.length, 'The DOCX package was empty.').toBeGreaterThan(0);
  expect(
    entries.length,
    'The DOCX package exceeded the bounded entry count.'
  ).toBeLessThanOrEqual(MAX_ARCHIVE_ENTRIES);
  expect(
    entries.filter(entry =>
      entry.startsWith('/')
      || entry.includes('\\')
      || entry.split('/').includes('..')
    ),
    'The DOCX package contained an unsafe archive path.'
  ).toEqual([]);
  expect(entries).toContain('[Content_Types].xml');
  expect(entries).toContain('_rels/.rels');
  expect(entries).toContain('word/document.xml');
  expect(
    entries.some(entry => /(?:^|\/)vbaProject\.bin$/i.test(entry)),
    'The generated DOCX unexpectedly contained executable macro content.'
  ).toBe(false);

  const contentTypes = await runLocalTool(
    'unzip',
    ['-p', outputPath, '[[]Content_Types].xml']
  );
  expect(contentTypes).toContain(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
  );
  const documentXml = await runLocalTool(
    'unzip',
    ['-p', outputPath, 'word/document.xml']
  );
  expect(documentXml).toMatch(/^<\?xml[^>]*>\s*<w:document\b/);
  expect(documentXml).toContain('<w:body>');
  expect(documentXml).toContain('</w:document>');
  expect(documentXml, 'The DOCX used unsupported externally-injected document content.')
    .not.toMatch(/<w:altChunk\b/);
  return normaliseText(decodeXmlText(documentXml));
}

async function extractPdfText(outputPath: string, bytes: Buffer): Promise<string> {
  expect(
    bytes.subarray(0, 8).toString('ascii'),
    'The PDF did not have a supported PDF file signature.'
  ).toMatch(/^%PDF-1\.[4-9]/);
  expect(
    bytes.subarray(Math.max(0, bytes.length - 1_024)).toString('latin1'),
    'The PDF did not contain a bounded end-of-file marker.'
  ).toContain('%%EOF');

  const metadata = await runLocalTool('pdfinfo', [outputPath]);
  expect(metadata).toMatch(/^PDF version:\s+1\.[4-9]\s*$/m);
  expect(metadata).toMatch(/^Encrypted:\s+no\s*$/m);
  const pages = Number(metadata.match(/^Pages:\s+(\d+)\s*$/m)?.[1]);
  expect(pages, 'The PDF page structure was unavailable.').toBeGreaterThan(0);
  expect(pages, 'The generated PDF exceeded the bounded page count.')
    .toBeLessThanOrEqual(20);
  return normaliseText(await runLocalTool('pdftotext', ['-layout', outputPath, '-']));
}

export async function inspectGeneratedDocument(
  outputPath: string,
  kind: DocumentKind,
  format: DocumentFormat,
  context: DocumentValidationContext
): Promise<void> {
  const stat = await fs.stat(outputPath);
  expect(stat.isFile(), `Downloaded review document ${outputPath} was not a file.`)
    .toBe(true);
  expect(stat.size, `Downloaded review document ${outputPath} was empty.`)
    .toBeGreaterThan(512);
  expect(
    stat.size,
    `Downloaded review document ${outputPath} exceeded the bounded file size.`
  ).toBeLessThanOrEqual(MAX_DOCUMENT_BYTES);
  const bytes = await fs.readFile(outputPath);
  const extractedText = format === 'docx'
    ? await extractDocxText(outputPath, bytes)
    : await extractPdfText(outputPath, bytes);
  validateGeneratedDocumentText(extractedText, kind, context);
}

export class StabilisationArtifacts {
  readonly root: string;

  constructor(
    private readonly repositoryRoot: string,
    configuredDirectory: string,
    private readonly runId: string
  ) {
    this.root = path.resolve(
      repositoryRoot,
      configuredDirectory,
      safeSegment(runId)
    );
  }

  async savePersistenceManifest(
    configuredPath: string,
    jobs: StabilisationJobRecord[]
  ): Promise<string> {
    expect(jobs, 'The persistence manifest must contain five completed jobs.').toHaveLength(5);
    expect(
      new Set(jobs.map(job => job.canonicalJobId)).size,
      'The persistence manifest jobs must be distinct.'
    ).toBe(5);
    for (const job of jobs) {
      expect(job.canonicalJobId, 'A manifest job omitted its canonical identity.')
        .toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
      expect(job.provider.trim(), 'A manifest job omitted its provider identity.').not.toBe('');
      expect(job.providerJobId?.trim(), 'A manifest job omitted its provider job identity.')
        .not.toBe('');
      expect(job.applicationId?.trim(), 'A manifest job omitted its application identity.')
        .not.toBe('');
      expect(job.cvDocumentId?.trim(), 'A manifest job omitted its CV document identity.')
        .not.toBe('');
      expect(
        job.coverLetterDocumentId?.trim(),
        'A manifest job omitted its cover-letter document identity.'
      ).not.toBe('');
      expect(
        job.requirementTerms,
        'A manifest job omitted its bounded job-description requirement terms.'
      ).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(
        job.requirementTerms.every(term =>
          term.trim().length > 0 && term.length <= 64
        ),
        'A manifest job contained an invalid job-description requirement term.'
      ).toBe(true);
      expect(
        job.requirementTerms.length,
        'A manifest job contained too many job-description requirement terms.'
      ).toBeLessThanOrEqual(12);
    }

    const boundary = path.resolve(
      this.repositoryRoot,
      'test-results',
      'stabilisation'
    );
    const outputPath = path.resolve(this.repositoryRoot, configuredPath);
    if (!outputPath.startsWith(`${boundary}${path.sep}`)) {
      throw new Error('The persistence manifest must stay under test-results/stabilisation.');
    }

    const manifest: StabilisationPersistenceManifest = {
      version: 2,
      runId: safeSegment(this.runId),
      jobs
    };
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const temporaryPath = `${outputPath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    });
    await fs.rename(temporaryPath, outputPath);
    await fs.chmod(outputPath, 0o600);
    return outputPath;
  }

  async screenshot(page: Page, name: string): Promise<string> {
    const outputPath = path.join(this.root, 'screenshots', `${safeSegment(name)}.png`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath, fullPage: true });
    await fs.chmod(outputPath, 0o600);
    const stat = await fs.stat(outputPath);
    expect(stat.size, `Screenshot ${outputPath} was empty.`).toBeGreaterThan(0);
    return outputPath;
  }

  async saveDocument(
    download: Download,
    runNumber: number,
    kind: DocumentKind,
    format: DocumentFormat,
    context: DocumentValidationContext
  ): Promise<string> {
    const failure = await download.failure();
    if (failure) throw new Error(`Synthetic review document download failed: ${failure}`);

    const suggestedExtension = path.extname(download.suggestedFilename()).toLowerCase();
    expect(
      suggestedExtension,
      `The ${kind} download did not use the expected ${format.toUpperCase()} format.`
    ).toBe(`.${format}`);

    const outputPath = path.join(
      this.root,
      'documents',
      `run-${runNumber}-${kind}.${format}`
    );
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await download.saveAs(outputPath);
    await fs.chmod(outputPath, 0o600);
    await inspectGeneratedDocument(outputPath, kind, format, context);
    return outputPath;
  }
}
