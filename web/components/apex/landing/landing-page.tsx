'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SpeakerCanvas } from './speaker-canvas';
import { CRTOverlay } from './crt-overlay';
import { useEasterEggs } from './easter-eggs';

export function LandingPage() {
  const router = useRouter();
  const [crtMessage, setCrtMessage] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

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

      {/* Mobile label */}
      {isMobile && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 font-mono text-xs pointer-events-none z-20 border border-emerald-900/40 px-3 py-1"
          style={{ color: '#10b981' }}
        >
          PORTABLE UNIT DETECTED
        </div>
      )}

      {/* Prompt */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 font-mono text-xs text-zinc-600 pointer-events-none animate-pulse z-20">
        press enter or click to begin_
      </div>
    </div>
  );
}
