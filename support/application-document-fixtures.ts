import { createHash } from 'node:crypto';

export interface ApplicationDocumentFixture {
  name: string;
  mimeType: string;
  bytes: Buffer;
  sha256: string;
}

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function fixture(name: string, mimeType: string, bytes: Buffer): ApplicationDocumentFixture {
  return { name, mimeType, bytes, sha256: sha256(bytes) };
}

function textPdf(text: string): Buffer {
  const escaped = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'ascii');
}

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Buffer {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes;
}

function u32(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value >>> 0);
  return bytes;
}

function zip(entries: Array<{ name: string; content: string }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const content = Buffer.from(entry.content, 'utf8');
    const checksum = crc32(content);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(checksum), u32(content.length), u32(content.length), u16(name.length), u16(0),
      name, content
    ]);
    locals.push(local);
    centrals.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(checksum), u32(content.length), u32(content.length), u16(name.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
    ]));
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  return Buffer.concat([
    ...locals,
    central,
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(offset), u16(0)
  ]);
}

function docx(documentXml: string, relationships = ''): Buffer {
  return zip([
    {
      name: '[Content_Types].xml',
      content: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    },
    {
      name: 'word/document.xml',
      content: `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${documentXml}</w:t></w:r></w:p></w:body></w:document>`
    },
    ...(relationships ? [{ name: 'word/_rels/document.xml.rels', content: relationships }] : [])
  ]);
}

export function applicationDocumentFixtures(): Record<string, ApplicationDocumentFixture> {
  const cvText = 'Synthetic CV for application-document E2E verification. No personal or provider data.';
  const coverText = 'Synthetic cover letter for application-document E2E verification.';
  const externalRelationship = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://invalid.test/track" TargetMode="External"/></Relationships>';
  return {
    cvPdf: fixture('synthetic-cv.pdf', PDF_MIME, textPdf(cvText)),
    coverPdf: fixture('synthetic-cover-letter.pdf', PDF_MIME, textPdf(coverText)),
    safeDocx: fixture('synthetic-cv.docx', DOCX_MIME, docx(cvText)),
    imageOnlyPdf: fixture('synthetic-image-only.pdf', PDF_MIME, textPdf('')),
    spoofedDocx: fixture('synthetic-spoofed.docx', DOCX_MIME, textPdf('not a DOCX package')),
    malformedPdf: fixture('synthetic-malformed.pdf', PDF_MIME, Buffer.from('%PDF-1.4\ntruncated', 'ascii')),
    oversizedPdf: fixture('synthetic-oversized.pdf', PDF_MIME, Buffer.alloc(10 * 1024 * 1024 + 1, 0x20)),
    externalRelationshipDocx: fixture('synthetic-external.docx', DOCX_MIME, docx(cvText, externalRelationship)),
    traversalDocx: fixture('synthetic-traversal.docx', DOCX_MIME, zip([{ name: '../escape.xml', content: '<synthetic />' }]))
  };
}
