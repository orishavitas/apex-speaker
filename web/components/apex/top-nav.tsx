'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard/projects', label: 'Projects' },
  { href: '/dashboard/drivers', label: 'Drivers' },
  { href: '/dashboard/workspace', label: 'Workspace' },
  { href: '/dashboard/chat', label: 'Chat' },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center px-4 gap-6 shrink-0">
      <Link href="/dashboard/chat" className="font-mono font-bold text-white text-sm mr-2">
        ◈ APEX
      </Link>
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`font-mono text-sm px-3 py-1 transition-colors ${
                active
                  ? 'text-white border-b-2 border-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
