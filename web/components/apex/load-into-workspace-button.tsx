'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { WORKSPACE_PROJECT_ID } from '@/lib/constants/workspace';

interface LoadIntoWorkspacButtonProps {
  vxProjectId: string;
}

export function LoadIntoWorkspaceButton({ vxProjectId }: LoadIntoWorkspacButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch('/api/design-state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: WORKSPACE_PROJECT_ID,
          activeVituixcadProjectId: vxProjectId,
          version: 0, // optimistic — server handles version gracefully; if 409, still navigate
        }),
      });
      // Even on version conflict (409) or error, we navigate — the workspace will reconcile
    } catch {
      // Ignore network errors — navigate anyway
    }
    router.push(`/dashboard/workspace?activeProject=${vxProjectId}`);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-mono text-zinc-100 transition-colors hover:bg-zinc-700 disabled:opacity-50"
    >
      {loading ? 'loading...' : 'load into workspace →'}
    </button>
  );
}
