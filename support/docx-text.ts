import {inflateRawSync} from 'node:zlib';

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const MAX_END_RECORD_SEARCH = 65_557;

export function docxParagraphs(bytes: Buffer): string[] {
  const xml = zipEntry(bytes, 'word/document.xml').toString('utf8');
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
    .map(match => [...match[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map(text => decodeXml(text[1]))
      .join('')
      .trim())
    .filter(Boolean);
}

function zipEntry(zip: Buffer, wantedName: string): Buffer {
  const minimumOffset = Math.max(0, zip.length - MAX_END_RECORD_SEARCH);
  let endOffset = -1;
  for (let offset = zip.length - 22; offset >= minimumOffset; offset -= 1) {
    if (zip.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error('DOCX has no ZIP central directory.');

  const entryCount = zip.readUInt16LE(endOffset + 10);
  let cursor = zip.readUInt32LE(endOffset + 16);
  for (let index = 0; index < entryCount; index += 1) {
    requireBounds(zip, cursor, 46);
    if (zip.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new Error('DOCX ZIP central directory is malformed.');
    }
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const uncompressedSize = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    requireBounds(zip, cursor + 46, nameLength + extraLength + commentLength);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (name === wantedName) {
      requireBounds(zip, localOffset, 30);
      if (zip.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) {
        throw new Error('DOCX ZIP local file header is malformed.');
      }
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      requireBounds(zip, dataOffset, compressedSize);
      const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);
      const content = method === 0
        ? Buffer.from(compressed)
        : method === 8
          ? inflateRawSync(compressed)
          : undefined;
      if (!content) throw new Error(`DOCX uses unsupported ZIP compression method ${method}.`);
      if (content.length !== uncompressedSize) {
        throw new Error('DOCX ZIP entry size does not match its central directory.');
      }
      return content;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`DOCX is missing ${wantedName}.`);
}

function requireBounds(bytes: Buffer, offset: number, length: number): void {
  if (!Number.isSafeInteger(offset)
      || !Number.isSafeInteger(length)
      || offset < 0
      || length < 0
      || offset + length > bytes.length) {
    throw new Error('DOCX ZIP entry exceeds the package bounds.');
  }
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}
