import { expect, test } from '@playwright/test';
import { applicationDocumentFixtures } from '../support/application-document-fixtures';

test('application-document fixtures are deterministic, synthetic and content-safe', () => {
  const first = applicationDocumentFixtures();
  const second = applicationDocumentFixtures();

  expect(Object.keys(first)).toEqual(Object.keys(second));
  for (const key of Object.keys(first)) {
    expect(first[key].sha256).toBe(second[key].sha256);
    expect(first[key].bytes.equals(second[key].bytes)).toBe(true);
    const searchable = first[key].bytes.toString('latin1');
    expect(searchable).not.toContain('Bernard');
    expect(searchable).not.toContain('OpenAI');
    expect(searchable).not.toContain('EICAR');
  }
});

test('valid browser fixtures have the expected bounded envelopes', () => {
  const fixtures = applicationDocumentFixtures();
  expect(fixtures.cvPdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(fixtures.coverPdf.bytes.subarray(-6).toString()).toContain('%%EOF');
  expect(fixtures.safeDocx.bytes.readUInt32LE(0)).toBe(0x04034b50);
  expect(fixtures.cvPdf.bytes.length).toBeLessThan(10 * 1024 * 1024);
  expect(fixtures.safeDocx.bytes.length).toBeLessThan(10 * 1024 * 1024);
});

test('adversarial fixtures are distinct without embedding live malware', () => {
  const fixtures = applicationDocumentFixtures();
  const hashes = [
    fixtures.imageOnlyPdf,
    fixtures.spoofedDocx,
    fixtures.malformedPdf,
    fixtures.oversizedPdf,
    fixtures.externalRelationshipDocx,
    fixtures.traversalDocx
  ].map(value => value.sha256);
  expect(new Set(hashes).size).toBe(hashes.length);
  expect(fixtures.oversizedPdf.bytes.length).toBe(10 * 1024 * 1024 + 1);
  expect(fixtures.externalRelationshipDocx.bytes.toString('latin1')).toContain('TargetMode="External"');
  expect(fixtures.traversalDocx.bytes.toString('latin1')).toContain('../escape.xml');
});
