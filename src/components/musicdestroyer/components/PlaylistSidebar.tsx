"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlaylistItem } from '../utils/playlist';

type Props = {
  open: boolean;
  items: PlaylistItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
};

export default function PlaylistSidebar({ open, items, currentIndex, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items.slice();
    base.sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    return base;
  }, [items, query, sortAsc]);

  // Keyboard navigation when drawer is open
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) e.preventDefault();
      if (e.key === 'Escape') onClose();
      const current = filtered.findIndex((it) => it.id === items[currentIndex]?.id);
      if (e.key === 'ArrowUp') {
        const idx = Math.max(0, current - 1);
        const nextItem = filtered[idx];
        const actualIndex = items.findIndex((it) => it.id === nextItem?.id);
        if (actualIndex >= 0) onSelect(actualIndex);
      } else if (e.key === 'ArrowDown') {
        const idx = Math.min(filtered.length - 1, current + 1);
        const nextItem = filtered[idx];
        const actualIndex = items.findIndex((it) => it.id === nextItem?.id);
        if (actualIndex >= 0) onSelect(actualIndex);
      } else if (e.key === 'Enter') {
        const currentItem = items[currentIndex];
        const idx = items.findIndex((it) => it.id === currentItem?.id);
        if (idx >= 0) onSelect(idx);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, items, currentIndex, onSelect, onClose]);

  return (
    <div className={`playlist-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="playlist-header panel p-3 flex items-center gap-2">
        <input
          type="text"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input"
          aria-label="Search playlist"
        />
        <button className="btn" onClick={() => setSortAsc((s) => !s)} aria-label="Toggle sort order">
          Sort: {sortAsc ? 'A→Z' : 'Z→A'}
        </button>
        <button className="btn ml-auto" onClick={onClose} aria-label="Close playlist">Close</button>
      </div>
      <div ref={listRef} className="playlist-list overflow-auto">
        {filtered.length === 0 && (
          <div className="text-slate-400 text-sm p-3">No items</div>
        )}
        {filtered.map((item) => {
          const idx = items.findIndex((it) => it.id === item.id);
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={item.id}
              className={`playlist-item w-full text-left ${isCurrent ? 'current' : ''} ${item.file ? '' : 'disabled'}`}
              onClick={() => item.file && onSelect(idx)}
              aria-label={`Load ${item.name}`}
            >
              <div className="flex items-center justify-between">
                <div className="truncate">
                  <span className="text-slate-200">{item.name}</span>
                  {!item.file && <span className="text-slate-500 text-xs ml-2">(needs re-import)</span>}
                </div>
                <div className="text-slate-400 text-xs flex gap-3">
                  {typeof item.duration === 'number' && <span>{formatDuration(item.duration)}</span>}
                  {typeof item.bitrateKbps !== 'undefined' && <span>{item.bitrateKbps === 'Unknown' ? '—' : `${item.bitrateKbps} kbps`}</span>}
                  {typeof item.sampleRate === 'number' && <span>{Math.round(item.sampleRate)} Hz</span>}
                  {typeof item.channels === 'number' && <span>{item.channels} ch</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(d?: number) {
  if (!d || !isFinite(d)) return '';
  const s = Math.floor(d);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}