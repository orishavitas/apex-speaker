export type DriverType =
  | 'woofer'
  | 'midrange'
  | 'tweeter'
  | 'supertweeter'
  | 'subwoofer'
  | 'fullrange'
  | 'compression_driver'
  | 'ribbon'
  | 'planar'
  | 'coaxial';

const CATEGORY_MAP: [RegExp, DriverType][] = [
  [/sub/i,                    'subwoofer'],
  [/woof|bass/i,              'woofer'],
  [/mid|squawker/i,           'midrange'],
  [/super.?tweet/i,           'supertweeter'],
  [/tweet|hf|high.?freq/i,   'tweeter'],
  [/compres|cd\b|^driver$/i,  'compression_driver'],
  [/ribbon/i,                 'ribbon'],
  [/planar|amtx?/i,           'planar'],
  [/coax/i,                   'coaxial'],
  [/full.?range|fr\b/i,       'fullrange'],
];

export function inferDriverType(category?: string, fsHz?: number): DriverType {
  if (category) {
    for (const [re, type] of CATEGORY_MAP) {
      if (re.test(category)) return type;
    }
  }
  if (fsHz !== undefined) {
    if (fsHz < 100) return 'woofer';
    if (fsHz < 800) return 'midrange';
    return 'tweeter';
  }
  return 'woofer';
}
