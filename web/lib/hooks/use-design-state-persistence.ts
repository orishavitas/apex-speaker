'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WaySlot, WayCount } from '@/lib/types/speaker-domain';
import { defaultDesignState, defaultWaySlot } from '@/lib/types/speaker-domain';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface DesignState {
  numWays: WayCount;
  slots: WaySlot[];
  activeVituixcadProjectId: string | null;
  version: number;
}

export interface UseDesignStatePersistenceReturn {
  state: DesignState | null;
  isLoading: boolean;
  saveStatus: SaveStatus;
  updateWay: (index: number, partial: Partial<WaySlot>) => void;
  setNumWays: (n: WayCount) => void;
  setActiveProject: (vxProjectId: string | null) => void;
}

export function useDesignStatePersistence(projectId: string): UseDesignStatePersistenceReturn {
  const [state, setState] = useState<DesignState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  // Load state on mount
  useEffect(() => {
    isMountedRef.current = true;
    fetch(`/api/design-state?projectId=${projectId}`)
      .then(r => r.json())
      .then((data: { state: Record<string, unknown> }) => {
        if (!isMountedRef.current) return;
        const s = data.state;
        versionRef.current = (s.version as number) ?? 0;
        const waysConfig = s.waysConfig as WaySlot[] | undefined;
        const numWays = (s.numWays as WayCount) ?? 2;
        setState({
          numWays,
          slots: (waysConfig && waysConfig.length > 0)
            ? waysConfig
            : Array.from({ length: numWays }, (_, i) => defaultWaySlot(i)),
          activeVituixcadProjectId: (s.activeVituixcadProjectId as string | null) ?? null,
          version: (s.version as number) ?? 0,
        });
      })
      .catch(() => {
        if (!isMountedRef.current) return;
        // Offline: use defaults
        const defaults = defaultDesignState(projectId);
        setState({
          numWays: defaults.numWays as WayCount,
          slots: defaults.waysConfig,
          activeVituixcadProjectId: null,
          version: 0,
        });
      })
      .finally(() => {
        if (isMountedRef.current) setIsLoading(false);
      });
    return () => { isMountedRef.current = false; };
  }, [projectId]);

  // Debounced PATCH
  const scheduleSave = useCallback((nextState: DesignState) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      setSaveStatus('saving');
      try {
        const res = await fetch('/api/design-state', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            numWays: nextState.numWays,
            waysConfig: nextState.slots,
            activeVituixcadProjectId: nextState.activeVituixcadProjectId,
            version: versionRef.current,
          }),
        });
        if (!isMountedRef.current) return;
        if (res.status === 409) {
          // Version conflict — refetch
          const fresh = await fetch(`/api/design-state?projectId=${projectId}`).then(r => r.json()) as { state: Record<string, unknown> };
          versionRef.current = (fresh.state.version as number) ?? 0;
          setState({
            numWays: fresh.state.numWays as WayCount,
            slots: (fresh.state.waysConfig as WaySlot[]) ?? [],
            activeVituixcadProjectId: (fresh.state.activeVituixcadProjectId as string | null) ?? null,
            version: fresh.state.version as number,
          });
          setSaveStatus('error');
          return;
        }
        if (res.ok) {
          const data = await res.json() as { state: Record<string, unknown> };
          versionRef.current = (data.state.version as number) ?? versionRef.current + 1;
          setSaveStatus('saved');
          setTimeout(() => {
            if (isMountedRef.current) setSaveStatus('idle');
          }, 2000);
        } else {
          setSaveStatus('error');
        }
      } catch {
        if (isMountedRef.current) setSaveStatus('error');
      }
    }, 800);
  }, [projectId]);

  const updateWay = useCallback((index: number, partial: Partial<WaySlot>) => {
    setState(prev => {
      if (!prev) return prev;
      const slots = prev.slots.map((s, i) => i === index ? { ...s, ...partial } : s);
      const next = { ...prev, slots };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const setNumWays = useCallback((n: WayCount) => {
    setState(prev => {
      if (!prev) return prev;
      const currentSlots = prev.slots;
      let slots: WaySlot[];
      if (n > currentSlots.length) {
        // Append new default slots
        slots = [
          ...currentSlots,
          ...Array.from({ length: n - currentSlots.length }, (_, i) => defaultWaySlot(currentSlots.length + i)),
        ];
      } else {
        // Truncate
        slots = currentSlots.slice(0, n);
      }
      const next = { ...prev, numWays: n, slots };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const setActiveProject = useCallback((vxProjectId: string | null) => {
    setState(prev => {
      if (!prev) return prev;
      const next = { ...prev, activeVituixcadProjectId: vxProjectId };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  return { state, isLoading, saveStatus, updateWay, setNumWays, setActiveProject };
}
