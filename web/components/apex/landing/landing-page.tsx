'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SpeakerCanvas } from './speaker-canvas';
import { CRTOverlay } from './crt-overlay';

export function LandingPage() {
  const router = useRouter();
  const [crtMessage, setCrtMessage] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);

  const advance = () => router.push('/dashboard/chat');

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black cursor-pointer"
      onClick={advance}
    >
      <SpeakerCanvas activeBrand={activeBrand} />
      <CRTOverlay />

      {/* APEX symbol */}
      <div
        className="absolute top-8 left-1/2 -translate-x-1/2 font-mono text-2xl select-none z-20"
        style={{ color: '#10b981', textShadow: '0 0 20px #10b981, 0 0 40px #10b981' }}
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
