'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type UploadState = 'idle' | 'drag' | 'parsing' | 'success' | 'error';

interface ProjectRow {
  id: string;
  fileType: string;
  fileName: string;
  createdAt: string;
}

interface UploadResult {
  id?: string;
  fileType?: string;
  fileName?: string;
  error?: string;
}

export default function ProjectsPage() {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [parseStatus, setParseStatus] = useState('');

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch {
      // silent
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  // Load on mount
  useState(() => { loadProjects(); });

  const handleFile = useCallback(async (file: File) => {
    setUploadState('parsing');
    setParseStatus('Reading file...');

    const formData = new FormData();
    formData.append('file', file);

    setParseStatus('Parsing XML structure...');

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setUploadState('error');
        setUploadResult({ error: data.error ?? 'Upload failed', fileName: file.name });
        return;
      }

      setUploadState('success');
      setUploadResult(data);
      loadProjects();
    } catch (e) {
      setUploadState('error');
      setUploadResult({ error: String(e), fileName: file.name });
    }
  }, [loadProjects]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setUploadState('idle');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const FILE_TYPE_COLORS: Record<string, string> = {
    vxp: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    vxd: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    vxb: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-mono font-bold text-white">VituixCAD Projects</h1>
      </div>

      {/* Upload Zone */}
      {uploadState === 'idle' || uploadState === 'drag' ? (
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center mb-8 transition-colors ${
            uploadState === 'drag'
              ? 'border-violet-500 bg-zinc-800 text-violet-300'
              : 'border-zinc-700 bg-zinc-900 text-zinc-500'
          }`}
          onDragOver={(e) => { e.preventDefault(); setUploadState('drag'); }}
          onDragLeave={() => setUploadState('idle')}
          onDrop={onDrop}
        >
          <div className="text-4xl mb-3">◈</div>
          <p className="font-mono text-sm mb-4">
            drop .vxp / .vxd / .vxb files here<br />
            <span className="text-zinc-600">or click to browse</span>
          </p>
          <label>
            <input type="file" className="hidden" accept=".vxp,.vxd,.vxb" onChange={onFileInput} />
            <Button variant="outline" size="sm" className="cursor-pointer" asChild>
              <span>choose files</span>
            </Button>
          </label>
        </div>
      ) : uploadState === 'parsing' ? (
        <Card className="bg-zinc-900 border-zinc-800 p-6 mb-8">
          <div className="font-mono text-sm text-zinc-400 mb-2">parsing...</div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-3">
            <div className="bg-violet-500 h-1.5 rounded-full animate-pulse w-2/3" />
          </div>
          <div className="font-mono text-xs text-zinc-500">{parseStatus}</div>
        </Card>
      ) : uploadState === 'success' ? (
        <Card className="bg-zinc-900 border-zinc-800 p-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-emerald-400">✓</span>
            <span className="font-mono text-sm text-white">{uploadResult?.fileName}</span>
            {uploadResult?.fileType && (
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${FILE_TYPE_COLORS[uploadResult.fileType] ?? ''}`}>
                .{uploadResult.fileType}
              </span>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            {uploadResult?.id && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/dashboard/projects/${uploadResult.id}`}>open project →</a>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setUploadState('idle')}>
              upload another
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="bg-zinc-900 border-zinc-800 border-red-900/30 p-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400">✗</span>
            <span className="font-mono text-sm text-zinc-400">{uploadResult?.fileName}</span>
          </div>
          <div className="font-mono text-xs text-red-400 mb-3">{uploadResult?.error}</div>
          <Button variant="outline" size="sm" onClick={() => setUploadState('idle')}>retry</Button>
        </Card>
      )}

      {/* Projects List */}
      <div>
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Recent Projects</h2>
        {loadingProjects ? (
          <div className="font-mono text-xs text-zinc-600">loading...</div>
        ) : projects.length === 0 ? (
          <div className="font-mono text-xs text-zinc-600">No projects yet. Upload a .vxp file to get started.</div>
        ) : (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left font-mono text-xs text-zinc-500 px-4 py-2">NAME</th>
                  <th className="text-left font-mono text-xs text-zinc-500 px-4 py-2">TYPE</th>
                  <th className="text-left font-mono text-xs text-zinc-500 px-4 py-2">CREATED</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr key={p.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 ${i % 2 === 0 ? '' : 'bg-zinc-900/20'}`}>
                    <td className="font-mono text-sm text-white px-4 py-2">{p.fileName}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded border ${FILE_TYPE_COLORS[p.fileType] ?? 'text-zinc-400'}`}>
                        .{p.fileType}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-zinc-500 px-4 py-2">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <a href={`/dashboard/projects/${p.id}`} className="text-xs font-mono text-violet-400 hover:text-violet-300">
                        view →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
