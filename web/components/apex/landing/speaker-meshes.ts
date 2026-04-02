import * as THREE from 'three';

export type BrandId =
  | 'KLIPSCH' | 'FOCAL' | 'JBL' | 'GENELEC' | 'BOWERS' | 'HARBETH';

export interface SpeakerMeshConfig {
  label: string;
  // Approximate cabinet dimensions (W x H x D in Three.js units)
  cabinetW: number;
  cabinetH: number;
  cabinetD: number;
  // Woofer cone radius
  wooferR: number;
  // Tweeter cone radius
  tweeterR: number;
  // Whether it has a horn (Klipsch)
  hasHorn: boolean;
}

export const BRAND_MESHES: Record<BrandId, SpeakerMeshConfig> = {
  KLIPSCH: { label: 'KLIPSCHORN', cabinetW: 0.9, cabinetH: 1.4, cabinetD: 0.6, wooferR: 0.22, tweeterR: 0.05, hasHorn: true },
  FOCAL:   { label: 'UTOPIA',    cabinetW: 0.35, cabinetH: 1.1, cabinetD: 0.38, wooferR: 0.16, tweeterR: 0.03, hasHorn: false },
  JBL:     { label: '4350',      cabinetW: 0.7, cabinetH: 1.0, cabinetD: 0.5,  wooferR: 0.22, tweeterR: 0.06, hasHorn: true },
  GENELEC: { label: '8050',      cabinetW: 0.2, cabinetH: 0.32, cabinetD: 0.22, wooferR: 0.09, tweeterR: 0.025, hasHorn: false },
  BOWERS:  { label: '802',       cabinetW: 0.3, cabinetH: 1.1, cabinetD: 0.35, wooferR: 0.165, tweeterR: 0.03, hasHorn: false },
  HARBETH: { label: 'M30',       cabinetW: 0.28, cabinetH: 0.42, cabinetD: 0.27, wooferR: 0.1, tweeterR: 0.025, hasHorn: false },
};

export const KNOWN_BRANDS = Object.keys(BRAND_MESHES) as BrandId[];

/** Build a Three.js Group representing a speaker with the given config (wireframe) */
export function buildSpeakerGroup(config: SpeakerMeshConfig): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });

  // Cabinet
  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(config.cabinetW, config.cabinetH, config.cabinetD),
    mat
  );
  group.add(cabinet);

  // Woofer cone (ConeGeometry facing forward)
  const woofer = new THREE.Mesh(
    new THREE.ConeGeometry(config.wooferR, config.wooferR * 0.8, 16),
    mat
  );
  woofer.rotation.x = -Math.PI / 2;
  woofer.position.set(0, config.cabinetH * 0.15, config.cabinetD / 2);
  group.add(woofer);

  // Tweeter
  const tweeter = new THREE.Mesh(
    new THREE.ConeGeometry(config.tweeterR, config.tweeterR * 0.6, 12),
    mat
  );
  tweeter.rotation.x = -Math.PI / 2;
  tweeter.position.set(0, config.cabinetH * 0.38, config.cabinetD / 2);
  group.add(tweeter);

  // Horn flare (optional)
  if (config.hasHorn) {
    const horn = new THREE.Mesh(
      new THREE.CylinderGeometry(config.wooferR * 0.4, config.wooferR * 1.2, config.cabinetH * 0.3, 16, 1, true),
      mat
    );
    horn.rotation.x = Math.PI / 2;
    horn.position.set(0, config.cabinetH * 0.38, config.cabinetD / 2 + 0.05);
    group.add(horn);
  }

  return group;
}

/** Default generic speaker group */
export function buildDefaultSpeakerGroup(): THREE.Group {
  return buildSpeakerGroup({
    label: 'GENERIC',
    cabinetW: 0.28, cabinetH: 0.46, cabinetD: 0.25,
    wooferR: 0.1, tweeterR: 0.025, hasHorn: false,
  });
}
