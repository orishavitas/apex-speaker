# Sprint 4a — Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current root `/` redirect with a full-viewport procedurally-generated isometric wireframe speaker animation — cyberpunk/CRT aesthetic, slow rotation, dot-matrix grid floor, neon phosphor glow — with easter eggs and a click-through to `/dashboard/chat`.

**Architecture:** Next.js root page (`app/page.tsx`) becomes a full-screen client component. Three.js renders the speaker geometry via a `<canvas>` element. Easter egg state is managed in a single React component. Clicking anywhere / pressing Enter / typing routes to `/dashboard/chat`. Brand mesh swapping uses a small registry of parametric geometries.

**Tech Stack:** Next.js 16, Three.js (`three`), TypeScript, Tailwind CSS. No React Three Fiber — raw Three.js for minimal bundle and maximum control over the CRT/scanline shader effects.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `web/app/page.tsx` | Root route — render `<LandingPage />` instead of redirect |
| Create | `web/components/apex/landing/landing-page.tsx` | Full client component, mounts canvas, handles routing |
| Create | `web/components/apex/landing/speaker-canvas.tsx` | Three.js scene: speaker geometry, rotation, grid, glow |
| Create | `web/components/apex/landing/speaker-meshes.ts` | Brand mesh registry: parametric geometry per brand |
| Create | `web/components/apex/landing/easter-eggs.ts` | Easter egg logic: Konami detector, idle timer, sudo handler |
| Create | `web/components/apex/landing/crt-overlay.tsx` | Scanline + CRT curvature CSS overlay (pure CSS, no canvas) |

---

## Task 1: Install Three.js

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install Three.js and its types**

```bash
cd web && npm install three @types/three
```

Expected output: three added to dependencies, @types/three to devDependencies.

- [ ] **Step 2: Verify install**

```bash
node -e "require('three'); console.log('three ok')"
```

Expected: `three ok`

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore: add three.js dependency for landing page"
```

---

## Task 2: Root Page Shell

**Files:**
- Modify: `web/app/page.tsx`
- Create: `web/components/apex/landing/landing-page.tsx`

- [ ] **Step 1: Create the landing page client component shell**

Create `web/components/apex/landing/landing-page.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SpeakerCanvas } from './speaker-canvas';
import { CRTOverlay } from './crt-overlay';

export function LandingPage() {
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [crtMessage, setCrtMessage] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const advance = () => router.push('/dashboard/chat');

  // Focus input on mount so typing works immediately
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Click anywhere advances
  const handleClick = () => advance();

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black cursor-pointer"
      onClick={handleClick}
    >
      {/* Three.js canvas */}
      <SpeakerCanvas activeBrand={activeBrand} />

      {/* CRT scanline overlay */}
      <CRTOverlay />

      {/* APEX symbol */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 font-mono text-2xl text-emerald-400 select-none pointer-events-none"
        style={{ textShadow: '0 0 20px #10b981, 0 0 40px #10b981' }}>
        ◈
      </div>

      {/* CRT message overlay */}
      {crtMessage && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-emerald-400 text-sm text-center pointer-events-none"
          style={{ textShadow: '0 0 10px #10b981' }}>
          {crtMessage}
        </div>
      )}

      {/* Hidden input to capture keystrokes */}
      <input
        ref={inputRef}
        className="absolute opacity-0 w-0 h-0"
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') advance();
        }}
        onClick={e => e.stopPropagation()}
      />

      {/* Prompt text */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 font-mono text-xs text-zinc-600 pointer-events-none animate-pulse">
        press enter or click to begin_
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update root page to render LandingPage instead of redirecting**

Overwrite `web/app/page.tsx`:

```tsx
import { LandingPage } from '@/components/apex/landing/landing-page';

export default function Home() {
  return <LandingPage />;
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (SpeakerCanvas and CRTOverlay don't exist yet — create stubs next).

- [ ] **Step 4: Commit**

```bash
git add web/app/page.tsx web/components/apex/landing/landing-page.tsx
git commit -m "feat: landing page shell — replaces root redirect"
```

---

## Task 3: CRT Overlay

**Files:**
- Create: `web/components/apex/landing/crt-overlay.tsx`

- [ ] **Step 1: Create the CRT scanline overlay**

Create `web/components/apex/landing/crt-overlay.tsx`:

```tsx
export function CRTOverlay() {
  return (
    <>
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
          zIndex: 10,
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.7) 100%)',
          zIndex: 11,
        }}
      />
      {/* Subtle CRT barrel distortion — CSS only approximation */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5)',
          zIndex: 12,
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add web/components/apex/landing/crt-overlay.tsx
git commit -m "feat: CRT scanline/vignette overlay for landing page"
```

---

## Task 4: Speaker Mesh Registry

**Files:**
- Create: `web/components/apex/landing/speaker-meshes.ts`

- [ ] **Step 1: Create the brand mesh registry**

Create `web/components/apex/landing/speaker-meshes.ts`:

```ts
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/apex/landing/speaker-meshes.ts
git commit -m "feat: speaker mesh registry for landing page brand easter eggs"
```

---

## Task 5: Three.js Speaker Canvas

**Files:**
- Create: `web/components/apex/landing/speaker-canvas.tsx`

- [ ] **Step 1: Create the Three.js canvas component**

Create `web/components/apex/landing/speaker-canvas.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  buildSpeakerGroup,
  buildDefaultSpeakerGroup,
  BRAND_MESHES,
  type BrandId,
} from './speaker-meshes';

interface SpeakerCanvasProps {
  activeBrand: string | null;
}

export function SpeakerCanvas({ activeBrand }: SpeakerCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    speakerGroup: THREE.Group;
    animId: number;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera — isometric-ish perspective
    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(2.5, 1.8, 2.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    // Dot-matrix grid floor
    const gridHelper = new THREE.GridHelper(6, 24, 0x00ff44, 0x003311);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // Speaker group
    const speakerGroup = buildDefaultSpeakerGroup();
    scene.add(speakerGroup);

    // Ambient glow — point light with neon green
    const light = new THREE.PointLight(0x00ff88, 2, 10);
    light.position.set(1, 2, 2);
    scene.add(light);

    // Animation loop — slow rotation
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      speakerGroup.rotation.y += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { renderer, scene, camera, speakerGroup, animId };

    // Handle resize
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // Swap mesh when activeBrand changes
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;

    refs.scene.remove(refs.speakerGroup);

    let newGroup: THREE.Group;
    if (activeBrand && activeBrand in BRAND_MESHES) {
      newGroup = buildSpeakerGroup(BRAND_MESHES[activeBrand as BrandId]);
    } else {
      newGroup = buildDefaultSpeakerGroup();
    }

    // Preserve current rotation
    newGroup.rotation.y = refs.speakerGroup.rotation.y;
    refs.scene.add(newGroup);
    sceneRef.current = { ...refs, speakerGroup: newGroup };
  }, [activeBrand]);

  return <div ref={mountRef} className="absolute inset-0" />;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/apex/landing/speaker-canvas.tsx
git commit -m "feat: Three.js isometric speaker canvas with neon wireframe and grid"
```

---

## Task 6: Easter Egg Logic

**Files:**
- Create: `web/components/apex/landing/easter-eggs.ts`
- Modify: `web/components/apex/landing/landing-page.tsx`

- [ ] **Step 1: Create easter egg hook**

Create `web/components/apex/landing/easter-eggs.ts`:

```ts
import { useEffect, useRef, useCallback } from 'react';
import { KNOWN_BRANDS, type BrandId } from './speaker-meshes';

const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

interface EasterEggHandlers {
  onCrtMessage: (msg: string | null) => void;
  onBrandChange: (brand: string | null) => void;
  onAdvance: () => void;
}

export function useEasterEggs({ onCrtMessage, onBrandChange, onAdvance }: EasterEggHandlers) {
  const konamiRef = useRef<string[]>([]);
  const apexClickRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputBufferRef = useRef('');

  // Reset idle timer on any interaction
  const resetIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      onCrtMessage('MAINFRAME SLEEP MODE');
      // De-render handled by speaker-canvas fade (future enhancement)
    }, 60_000);
  }, [onCrtMessage]);

  // Konami code listener
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      resetIdle();

      // Konami code tracking
      konamiRef.current.push(e.key);
      if (konamiRef.current.length > KONAMI.length) konamiRef.current.shift();
      if (JSON.stringify(konamiRef.current) === JSON.stringify(KONAMI)) {
        onCrtMessage('CHEAT ACTIVATED');
        setTimeout(() => onCrtMessage(null), 2000);
        konamiRef.current = [];
      }

      // Brand detection — accumulate printable chars
      if (e.key.length === 1) {
        inputBufferRef.current = (inputBufferRef.current + e.key.toUpperCase()).slice(-12);
        const match = KNOWN_BRANDS.find(b => inputBufferRef.current.includes(b));
        if (match) {
          onBrandChange(match);
          onCrtMessage(BRAND_LABELS[match as BrandId] ?? match);
          setTimeout(() => onCrtMessage(null), 1500);
          inputBufferRef.current = '';
        }
        // Sudo easter egg
        if (inputBufferRef.current.endsWith('SUDO')) {
          onCrtMessage('Permission denied. You are not authorised.');
          setTimeout(() => onCrtMessage(null), 2000);
        }
      }

      // Enter advances
      if (e.key === 'Enter') onAdvance();
    };

    window.addEventListener('keydown', handleKey);
    resetIdle();
    return () => {
      window.removeEventListener('keydown', handleKey);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdle, onBrandChange, onCrtMessage, onAdvance]);

  // ◈ triple-click handler — returned for attaching to the ◈ element
  const handleApexClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    apexClickRef.current += 1;
    if (apexClickRef.current >= 3) {
      onCrtMessage('SEEING THROUGH THE SIMULATION');
      setTimeout(() => onCrtMessage(null), 2000);
      apexClickRef.current = 0;
    }
    setTimeout(() => { apexClickRef.current = 0; }, 800);
  }, [onCrtMessage]);

  return { handleApexClick };
}

const BRAND_LABELS: Partial<Record<BrandId, string>> = {
  KLIPSCH: 'LOADING: KLIPSCHORN',
  FOCAL:   'LOADING: UTOPIA',
  JBL:     'LOADING: 4350 STUDIO MONITOR',
  GENELEC: 'LOADING: 8050',
  BOWERS:  'LOADING: 802 D4',
  HARBETH: 'LOADING: M30.2',
};
```

- [ ] **Step 2: Wire easter eggs into LandingPage**

Update `web/components/apex/landing/landing-page.tsx` — replace the existing content with:

```tsx
'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SpeakerCanvas } from './speaker-canvas';
import { CRTOverlay } from './crt-overlay';
import { useEasterEggs } from './easter-eggs';

export function LandingPage() {
  const router = useRouter();
  const [crtMessage, setCrtMessage] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);

  const advance = () => router.push('/dashboard/chat');

  const { handleApexClick } = useEasterEggs({
    onCrtMessage: setCrtMessage,
    onBrandChange: setActiveBrand,
    onAdvance: advance,
  });

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black cursor-pointer"
      onClick={advance}
    >
      <SpeakerCanvas activeBrand={activeBrand} />
      <CRTOverlay />

      {/* APEX symbol — triple-click easter egg */}
      <div
        className="absolute top-8 left-1/2 -translate-x-1/2 font-mono text-2xl select-none z-20"
        style={{ color: '#10b981', textShadow: '0 0 20px #10b981, 0 0 40px #10b981' }}
        onClick={handleApexClick}
      >
        ◈
      </div>

      {/* CRT message */}
      {crtMessage && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-sm text-center pointer-events-none z-30 px-4 py-2 border border-emerald-800/40 bg-black/60"
          style={{ color: '#10b981', textShadow: '0 0 10px #10b981' }}
        >
          {crtMessage}
        </div>
      )}

      {/* Prompt */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 font-mono text-xs text-zinc-600 pointer-events-none animate-pulse z-20">
        press enter or click to begin_
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/apex/landing/easter-eggs.ts web/components/apex/landing/landing-page.tsx
git commit -m "feat: landing page easter eggs — Konami, brand meshes, sudo, apex triple-click"
```

---

## Task 7: Mobile Detection

**Files:**
- Modify: `web/components/apex/landing/landing-page.tsx`

- [ ] **Step 1: Add mobile detection and label**

Add a `useEffect` inside `LandingPage` (after the existing state declarations):

```tsx
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  setIsMobile(window.innerWidth < 768);
}, []);
```

Then add below the CRT message JSX:

```tsx
{/* Mobile label */}
{isMobile && (
  <div
    className="absolute top-20 left-1/2 -translate-x-1/2 font-mono text-xs pointer-events-none z-20 border border-emerald-900/40 px-3 py-1"
    style={{ color: '#10b981' }}
  >
    PORTABLE UNIT DETECTED
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/apex/landing/landing-page.tsx
git commit -m "feat: mobile detection easter egg on landing page"
```

---

## Task 8: Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Start dev server**

```bash
cd web && npm run dev
```

- [ ] **Step 2: Open browser at http://localhost:3000**

Expected: Black screen, isometric wireframe speaker rotating, neon green phosphor glow, dot-matrix grid, scanline overlay, ◈ symbol at top, "press enter or click to begin_" at bottom.

- [ ] **Step 3: Test entry**

Click anywhere. Expected: navigates to `/dashboard/chat`.

- [ ] **Step 4: Test Konami code**

Press: ↑ ↑ ↓ ↓ ← → ← → B A (keyboard). Expected: CRT message "CHEAT ACTIVATED" for 2 seconds.

- [ ] **Step 5: Test brand easter egg**

Type "FOCAL" on keyboard. Expected: speaker geometry swaps to taller tower silhouette, CRT message "LOADING: UTOPIA".

- [ ] **Step 6: Test sudo**

Type "sudo". Expected: CRT message "Permission denied. You are not authorised."

- [ ] **Step 7: Test ◈ triple-click**

Click the ◈ symbol three times quickly. Expected: CRT message "SEEING THROUGH THE SIMULATION".

- [ ] **Step 8: Final TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1
```

Expected: exit code 0, no output.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat: Sprint 4a complete — landing page with Three.js isometric speaker"
```
