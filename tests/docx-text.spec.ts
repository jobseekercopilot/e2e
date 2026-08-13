import {expect, test} from '@playwright/test';
import {deflateRawSync} from 'node:zlib';
import {applicationDocumentFixtures} from '../support/application-document-fixtures';
import {docxParagraphs} from '../support/docx-text';

test('extracts bounded paragraph text from a synthetic DOCX package', () => {
  expect(docxParagraphs(applicationDocumentFixtures().safeDocx.bytes)).toEqual([
    'Synthetic CV for application-document E2E verification. No personal or provider data.',
  ]);
});

test('rejects a non-ZIP payload instead of scanning arbitrary bytes', () => {
  expect(() => docxParagraphs(Buffer.from('not a DOCX package')))
    .toThrow('DOCX has no ZIP central directory.');
});

test('extracts deflated Word XML written by production-style DOCX exporters', () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>Portfolio: </w:t></w:r>'
    + '<w:hyperlink><w:r><w:t>https://portfolio.example.test</w:t></w:r></w:hyperlink>'
    + '</w:p></w:body></w:document>';
  expect(docxParagraphs(deflatedDocx(xml))).toEqual([
    'Portfolio: https://portfolio.example.test',
  ]);
});

function deflatedDocx(xml: string): Buffer {
  const name = Buffer.from('word/document.xml');
  const content = Buffer.from(xml);
  const compressed = deflateRawSync(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(name.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(name.length, 28);

  const localEntry = Buffer.concat([local, name, compressed]);
  const centralEntry = Buffer.concat([central, name]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralEntry.length, 12);
  end.writeUInt32LE(localEntry.length, 16);
  return Buffer.concat([localEntry, centralEntry, end]);
}
