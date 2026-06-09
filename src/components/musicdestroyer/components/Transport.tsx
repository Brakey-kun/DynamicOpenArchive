"use client";
import * as Slider from '@radix-ui/react-slider';
import { useEffect } from 'react';

type Props = {
  playing: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  bypass: boolean;
  onBypass: (checked: boolean) => void;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  shuffle?: boolean;
  onShuffleChange?: (on: boolean) => void;
  repeatMode?: 'off' | 'one' | 'all';
  onRepeatChange?: (mode: 'off' | 'one' | 'all') => void;
  currentTrackName?: string;
  upcomingCount?: number;
};

function fmtTime(sec: number) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function Transport({
  playing,
  onPlayPause,
  onReset,
  bypass,
  onBypass,
  currentTime,
  duration,
  onSeek,
  onPrev,
  onNext,
  shuffle,
  onShuffleChange,
  repeatMode,
  onRepeatChange,
  currentTrackName,
  upcomingCount,
}: Props) {
  // keyboard shortcuts: Left/Right for prev/next, S shuffle, R repeat cycle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); onPrev?.(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); onNext?.(); }
      else if (e.key.toLowerCase() === 's') { e.preventDefault(); onShuffleChange?.(!shuffle); }
      else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        const order: Array<'off' | 'one' | 'all'> = ['off', 'one', 'all'];
        const idx = order.indexOf(repeatMode || 'off');
        const next = order[(idx + 1) % order.length];
        onRepeatChange?.(next);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPrev, onNext, onShuffleChange, shuffle, repeatMode, onRepeatChange]);

  return (
    <div className="panel p-4 mt-6">
      <div className="flex items-center gap-3 mb-3">
        <button className="btn btn-primary" onClick={onPlayPause} aria-label="Play/Pause">{playing ? 'Pause' : 'Play'}</button>
        <button className="btn" onClick={onReset} aria-label="Reset to Original">Reset</button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bypass} onChange={(e) => onBypass(e.target.checked)} aria-label="Bypass processing" />
          Bypass processing
        </label>
        <div className="flex items-center gap-2 ml-auto">
          {typeof currentTrackName === 'string' && (
            <span className="text-slate-300 text-sm truncate max-w-[240px]" aria-label="Current track">{currentTrackName}</span>
          )}
          <button className="btn" onClick={() => onPrev?.()} aria-label="Previous track">Prev</button>
          <button className="btn" onClick={() => onNext?.()} aria-label="Next track">Next</button>
          <button className={`btn ${shuffle ? 'btn-primary' : ''}`} onClick={() => onShuffleChange?.(!shuffle)} aria-label="Shuffle toggle">Shuffle</button>
          <button className="btn" onClick={() => {
            const order: Array<'off' | 'one' | 'all'> = ['off', 'one', 'all'];
            const idx = order.indexOf(repeatMode || 'off');
            const next = order[(idx + 1) % order.length];
            onRepeatChange?.(next);
          }} aria-label="Cycle repeat">
            Repeat: {repeatMode || 'off'}
          </button>
          {typeof upcomingCount === 'number' && (
            <span className="text-slate-400 text-xs" aria-label="Upcoming count">{upcomingCount} queued</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
        <span>{fmtTime(currentTime)}</span>
        <span>{fmtTime(duration || 0)}</span>
      </div>
      <Slider.Root
        className="relative flex items-center select-none touch-none h-5"
        min={0}
        max={Math.max(0, duration || 0)}
        step={0.01}
        value={[Math.min(currentTime, duration || 0)]}
        onValueChange={(vals) => onSeek(vals[0])}
      >
        <Slider.Track className="bg-slate-800 relative grow rounded-full h-2">
          <Slider.Range className="absolute h-full rounded-full bg-cyan-400" />
        </Slider.Track>
        <Slider.Thumb className="block w-4 h-4 rounded-full bg-cyan-300 accent-ring" aria-label="Seek" />
      </Slider.Root>
    </div>
  );
}