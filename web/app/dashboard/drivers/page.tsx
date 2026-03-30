'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DriverRow {
  id: string;
  manufacturer: string;
  model: string;
  driverType: string;
  nominalDiameterMm?: number;
  nominalImpedanceOhm?: number;
  fsHz?: number;
  qts?: number;
  vasLiters?: number;
  xmaxMm?: number;
  reOhm?: number;
  sdCm2?: number;
  bl?: number;
  leMh?: number;
  sensitivity1m1w?: number;
}

const DRIVER_TYPE_COLORS: Record<string, string> = {
  woofer:             'bg-amber-500/20 text-amber-300 border-amber-500/30',
  midrange:           'bg-sky-500/20 text-sky-300 border-sky-500/30',
  tweeter:            'bg-violet-500/20 text-violet-300 border-violet-500/30',
  supertweeter:       'bg-purple-500/20 text-purple-300 border-purple-500/30',
  subwoofer:          'bg-orange-500/20 text-orange-300 border-orange-500/30',
  fullrange:          'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  compression_driver: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

const ALL_TYPES = [
  'woofer', 'midrange', 'tweeter', 'supertweeter',
  'subwoofer', 'fullrange', 'compression_driver',
];

type SortKey = keyof DriverRow;

function fmt(v: number | undefined | null, decimals = 1): string {
  if (v === undefined || v === null) return '—';
  return v.toFixed(decimals);
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('fsHz');
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/drivers')
      .then(r => r.json())
      .then(d => setDrivers(d.drivers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let rows = drivers;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(d =>
        d.manufacturer.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q)
      );
    }
    if (selectedTypes.size > 0) {
      rows = rows.filter(d => selectedTypes.has(d.driverType));
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey] as number | string | undefined;
      const bv = b[sortKey] as number | string | undefined;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
  }, [drivers, search, selectedTypes, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const toggleType = (t: string) => {
    setSelectedTypes(s => {
      const next = new Set(s);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const cols: { key: SortKey; label: string; decimals?: number }[] = [
    { key: 'fsHz',           label: 'Fs (Hz)',   decimals: 1 },
    { key: 'qts',            label: 'Qts',       decimals: 2 },
    { key: 'vasLiters',      label: 'Vas (L)',   decimals: 1 },
    { key: 'xmaxMm',         label: 'Xmax (mm)', decimals: 1 },
    { key: 'reOhm',          label: 'Re (Ω)',    decimals: 1 },
    { key: 'sensitivity1m1w',label: 'SPL (dB)',  decimals: 1 },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-mono font-bold text-white">Driver Database</h1>
        <Button variant="outline" size="sm" className="font-mono text-xs">+ add driver</Button>
      </div>

      {/* Filter strip */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Input
          placeholder="search manufacturer / model"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64 font-mono text-xs bg-zinc-900 border-zinc-700 text-zinc-200"
        />
        {ALL_TYPES.map(t => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
              selectedTypes.has(t)
                ? (DRIVER_TYPE_COLORS[t] ?? 'bg-zinc-700 text-zinc-300 border-zinc-600')
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="text-left font-mono text-xs text-zinc-500 px-4 py-2">MANUFACTURER</th>
              <th className="text-left font-mono text-xs text-zinc-500 px-4 py-2">MODEL</th>
              <th className="text-left font-mono text-xs text-zinc-500 px-4 py-2">TYPE</th>
              {cols.map(c => (
                <th
                  key={String(c.key)}
                  className={`text-right font-mono text-xs px-4 py-2 cursor-pointer hover:text-zinc-300 ${
                    sortKey === c.key ? 'text-white border-b-2 border-white' : 'text-zinc-500'
                  }`}
                  onClick={() => toggleSort(c.key)}
                >
                  {c.label} {sortKey === c.key ? (sortAsc ? '↑' : '↓') : ''}
                </th>
              ))}
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center font-mono text-xs text-zinc-600">
                  loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center font-mono text-xs text-zinc-600">
                  {drivers.length === 0 ? 'No drivers in database yet.' : 'No matches.'}
                </td>
              </tr>
            ) : filtered.map((d) => (
              <>
                <tr
                  key={d.id}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer ${
                    expanded === d.id ? 'bg-zinc-800/40' : ''
                  }`}
                  onClick={() => setExpanded(e => e === d.id ? null : d.id)}
                >
                  <td className="font-mono text-sm text-zinc-200 px-4 py-2">{d.manufacturer}</td>
                  <td className="font-mono text-sm text-white px-4 py-2 font-medium">{d.model}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                      DRIVER_TYPE_COLORS[d.driverType] ?? 'text-zinc-400 border-zinc-700'
                    }`}>
                      {d.driverType}
                    </span>
                  </td>
                  {cols.map(c => (
                    <td key={String(c.key)} className="font-mono text-sm text-right px-4 py-2 text-zinc-300 tabular-nums">
                      {fmt(d[c.key] as number | undefined, c.decimals)}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    <span className="text-xs font-mono text-zinc-600">
                      {expanded === d.id ? '▲' : '▼'}
                    </span>
                  </td>
                </tr>
                {expanded === d.id && (
                  <tr key={`${d.id}-detail`} className="border-b border-zinc-800 bg-zinc-900/40">
                    <td colSpan={10} className="px-6 py-4">
                      <div className="grid grid-cols-4 gap-4">
                        {([
                          ['Re',   d.reOhm,          'Ω',    2],
                          ['Le',   d.leMh,           'mH',   3],
                          ['Bl',   d.bl,             'T·m',  2],
                          ['Sd',   d.sdCm2,          'cm²',  1],
                          ['Fs',   d.fsHz,           'Hz',   1],
                          ['Qts',  d.qts,            '',     3],
                          ['Qes',  undefined,        '',     3],
                          ['Qms',  undefined,        '',     3],
                          ['Vas',  d.vasLiters,      'L',    2],
                          ['Xmax', d.xmaxMm,         'mm',   1],
                          ['SPL',  d.sensitivity1m1w,'dB',   1],
                          ['Pmax', undefined,        'W',    0],
                        ] as [string, number | undefined, string, number][]).map(([label, val, unit, dec]) => (
                          <div
                            key={label}
                            className="flex justify-between font-mono text-xs border-b border-zinc-800/50 pb-1"
                          >
                            <span className="text-zinc-500">{label}</span>
                            <span className="text-zinc-200 tabular-nums">
                              {fmt(val, dec)}{' '}
                              <span className="text-zinc-600">{unit}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
