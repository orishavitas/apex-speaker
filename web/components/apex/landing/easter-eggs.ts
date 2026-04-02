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
