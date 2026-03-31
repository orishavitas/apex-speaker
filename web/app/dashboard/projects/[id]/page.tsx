import { notFound } from 'next/navigation';
import { LoadIntoWorkspaceButton } from '@/components/apex/load-into-workspace-button';

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;

  // Fetch project data
  let project: Record<string, unknown> | null = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/projects/${id}`, { cache: 'no-store' });
    if (res.status === 404) notFound();
    if (res.ok) {
      const data = await res.json();
      project = data.project;
    }
  } catch {
    // DB not available
  }

  if (!project) {
    return (
      <div className="p-6 font-mono text-zinc-500 text-sm">
        Project not found or database unavailable.
      </div>
    );
  }

  const parsedData = project.parsedData as Record<string, unknown>;

  return (
    <div className="p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="font-mono text-xs text-zinc-500 mb-4">
        <a href="/dashboard/projects" className="hover:text-zinc-300">Projects</a>
        <span className="mx-2">/</span>
        <span className="text-zinc-300">{String(project.fileName)}</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-mono font-bold text-white">{String(project.fileName)}</h1>
        <span className="text-xs font-mono px-2 py-0.5 rounded border bg-violet-500/20 text-violet-300 border-violet-500/30">
          .{String(project.fileType)}
        </span>
      </div>

      {/* Parsed data viewer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="font-mono text-xs text-zinc-500 mb-3 uppercase tracking-wider">Parsed Structure</div>
        <pre className="font-mono text-xs text-zinc-300 overflow-auto max-h-[600px] whitespace-pre-wrap">
          {JSON.stringify(parsedData, null, 2)}
        </pre>
      </div>

      <div className="mt-4">
        <LoadIntoWorkspaceButton vxProjectId={String(project.id)} />
      </div>
    </div>
  );
}
