import { XMLParser } from 'fast-xml-parser';
import type { VxpRaw, VxdRaw, VxbRaw } from './vituixcad-native';

const ALWAYS_ARRAY = ['DRIVER', 'RESPONSE', 'PART', 'PARAM', 'WIRE', 'CORNER'];

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '_',
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (tagName: string) => ALWAYS_ARRAY.includes(tagName),
} as const;

// Module-level singleton — XMLParser construction is not free
const parser = new XMLParser(PARSER_OPTIONS);

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly fileType: 'vxp' | 'vxd' | 'vxb',
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export function parseVxp(xml: string): VxpRaw {
  const raw = parser.parse(xml) as VxpRaw;
  if (!raw?.VITUIXCAD?.PROJECT) {
    throw new ParseError('Not a valid .vxp file: missing PROJECT root element', 'vxp');
  }
  return raw;
}

export function parseVxd(xml: string): VxdRaw {
  const raw = parser.parse(xml) as VxdRaw;
  if (!raw?.VITUIXCAD?.DATABASE) {
    throw new ParseError('Not a valid .vxd file: missing DATABASE root element', 'vxd');
  }
  // Ensure DRIVER is always an array (single-element edge case)
  if (raw.VITUIXCAD.DATABASE.DRIVER && !Array.isArray(raw.VITUIXCAD.DATABASE.DRIVER)) {
    raw.VITUIXCAD.DATABASE.DRIVER = [raw.VITUIXCAD.DATABASE.DRIVER as ReturnType<typeof raw.VITUIXCAD.DATABASE.DRIVER[0]['valueOf']>] as typeof raw.VITUIXCAD.DATABASE.DRIVER;
  }
  // Guard: individual drivers may have PARAM undefined if they have no parameters
  if (Array.isArray(raw.VITUIXCAD.DATABASE.DRIVER)) {
    for (const d of raw.VITUIXCAD.DATABASE.DRIVER) {
      d.PARAM = d.PARAM ?? [];
    }
  }
  return raw;
}

export function parseVxb(xml: string): VxbRaw {
  const raw = parser.parse(xml) as VxbRaw;
  if (!raw?.VITUIXCAD?.BAFFLE) {
    throw new ParseError('Not a valid .vxb file: missing BAFFLE root element', 'vxb');
  }
  return raw;
}

/** Detect file type from filename extension */
export function detectVxFileType(filename: string): 'vxp' | 'vxd' | 'vxb' | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'vxp') return 'vxp';
  if (ext === 'vxd') return 'vxd';
  if (ext === 'vxb') return 'vxb';
  return null;
}

/** Parse XML and return typed result based on file extension */
export function parseVxFile(xml: string, filename: string): VxpRaw | VxdRaw | VxbRaw {
  const type = detectVxFileType(filename);
  switch (type) {
    case 'vxp': return parseVxp(xml);
    case 'vxd': return parseVxd(xml);
    case 'vxb': return parseVxb(xml);
    default:
      throw new ParseError(`Unsupported file extension: ${filename}`, 'vxp');
  }
}
