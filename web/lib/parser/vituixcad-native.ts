// Raw shapes from fast-xml-parser — mirror of VituixCAD XML structure
// These types use VituixCAD's native naming (Re, fs, BL — not unit-suffixed)
// Convert to canonical ThieleSmallParams via ts-param-mapper.ts

export interface VxdParamRaw {
  _n: string;       // parameter name: "Re", "fs", "BL", etc.
  _v: string | number;
  _u?: string;      // unit string, optional
}

export interface VxdDriverRaw {
  _name: string;
  _brand?: string;
  _description?: string;
  _category?: string;
  PARAM: VxdParamRaw[];
}

export interface VxdRaw {
  VITUIXCAD?: {
    DATABASE?: {
      DRIVER: VxdDriverRaw[];
    };
  };
}

export interface VxpDriverRaw {
  _di: number;      // driver index
  _ri?: string;     // response file identifier
  _name?: string;
  _quantity?: number;
  PARAM?: VxdParamRaw[];
}

export interface VxpEnclosureRaw {
  _type?: string;   // "Closed", "Vented", etc.
  _volume?: number;
  _qtc?: number;
  PARAM?: VxdParamRaw[];
}

export interface VxpCrossoverPartRaw {
  _type: string;    // "Capacitor", "Inductor", "Resistor"
  _value?: number;
  _unit?: string;
}

export interface VxpCrossoverRaw {
  _name?: string;
  PART?: VxpCrossoverPartRaw[];
}

export interface VxpProjectRaw {
  _name?: string;
  _description?: string;
  _waycount?: number;
  DRIVER?: VxpDriverRaw[];
  ENCLOSURE?: VxpEnclosureRaw;
  CROSSOVER?: VxpCrossoverRaw[];
}

export interface VxpRaw {
  VITUIXCAD?: {
    PROJECT?: VxpProjectRaw;
  };
}

export interface VxbCornerRaw {
  _x: number;
  _y: number;
  _z?: number;
}

export interface VxbBaffleRaw {
  _width?: number;
  _height?: number;
  _depth?: number;
  CORNER?: VxbCornerRaw[];
}

export interface VxbRaw {
  VITUIXCAD?: {
    BAFFLE?: VxbBaffleRaw;
  };
}
