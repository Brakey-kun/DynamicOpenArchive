export type RepeatMode = 'off' | 'one' | 'all';

export type PlaylistItem = {
  id: string;
  name: string;
  file?: File; // not persisted
  duration?: number;
  sampleRate?: number;
  channels?: number;
  bitrateKbps?: number | 'Unknown';
};

type PersistedItem = Omit<PlaylistItem, 'file'>;

export class PlaylistManager {
  items: PlaylistItem[] = [];
  index = -1;
  shuffle = false;
  repeat: RepeatMode = 'off';
  private playedSet: Set<number> = new Set();
  private history: number[] = [];

  constructor(items?: PlaylistItem[], index?: number) {
    if (items) this.setItems(items);
    if (typeof index === 'number') this.index = index;
  }

  setItems(items: PlaylistItem[]) {
    this.items = items.slice();
    this.index = this.items.length ? 0 : -1;
    this.playedSet.clear();
    this.history = this.index >= 0 ? [this.index] : [];
  }

  addItems(items: PlaylistItem[]) {
    this.items.push(...items);
  }

  getCurrent(): PlaylistItem | null {
    if (this.index < 0 || this.index >= this.items.length) return null;
    return this.items[this.index];
  }

  applySelection(i: number) {
    const idx = Math.max(0, Math.min(i, this.items.length - 1));
    this.index = idx;
    this.playedSet.add(idx);
    // Avoid duplicate consecutive entries to keep back navigation stable
    if (this.history[this.history.length - 1] !== idx) {
      this.history.push(idx);
    }
  }

  nextIndex(): number | null {
    if (!this.items.length) return null;
    if (this.repeat === 'one' && this.index >= 0) return this.index;
    if (this.shuffle) return this.nextShuffledIndex();
    // sequential
    const next = this.index + 1;
    if (next < this.items.length) return next;
    if (this.repeat === 'all') return 0;
    return null;
  }

  prevIndex(): number | null {
    if (!this.items.length) return null;
    if (this.shuffle) {
      // go back in history if possible
      if (this.history.length >= 2) {
        // current is last, previous is second last
        const prev = this.history[this.history.length - 2];
        // pop current
        this.history.pop();
        this.index = prev;
        return prev;
      }
      // otherwise sequential fallback
    }
    const prev = this.index - 1;
    if (prev >= 0) return prev;
    if (this.repeat === 'all') return this.items.length - 1;
    return null;
  }

  private nextShuffledIndex(): number | null {
    const N = this.items.length;
    if (N === 0) return null;
    if (this.playedSet.size >= N) {
      if (this.repeat === 'all') {
        // reset cycle
        this.playedSet.clear();
        // keep current marked to avoid immediate repeat
        if (this.index >= 0) this.playedSet.add(this.index);
      } else {
        return null;
      }
    }
    const candidates: number[] = [];
    for (let i = 0; i < N; i++) {
      if (i === this.index) continue; // avoid immediate repeat
      if (!this.playedSet.has(i)) candidates.push(i);
    }
    if (!candidates.length) {
      // if only current remains unplayed, allow wrap
      for (let i = 0; i < N; i++) {
        if (i !== this.index) candidates.push(i);
      }
    }
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    return typeof next === 'number' ? next : null;
  }

  setShuffle(on: boolean) {
    this.shuffle = !!on;
    // reset cycle when toggled on
    this.playedSet.clear();
    if (this.index >= 0) this.playedSet.add(this.index);
  }

  setRepeat(mode: RepeatMode) {
    this.repeat = mode;
  }

  cycleRepeat(): RepeatMode {
    const order: RepeatMode[] = ['off', 'one', 'all'];
    const idx = order.indexOf(this.repeat);
    const next = order[(idx + 1) % order.length];
    this.repeat = next;
    return next;
  }

  upcomingCount(): number {
    if (!this.items.length || this.index < 0) return 0;
    if (this.shuffle) {
      const N = this.items.length;
      const remaining = Math.max(0, N - this.playedSet.size);
      return remaining;
    }
    return Math.max(0, this.items.length - (this.index + 1));
  }

  serialize(): { items: PersistedItem[]; index: number; shuffle: boolean; repeat: RepeatMode } {
    const lightweight = this.items.map(({ id, name, duration, sampleRate, channels, bitrateKbps }) => ({ id, name, duration, sampleRate, channels, bitrateKbps }));
    return { items: lightweight, index: this.index, shuffle: this.shuffle, repeat: this.repeat };
  }

  static deserialize(data: { items?: PersistedItem[]; index?: number; shuffle?: boolean; repeat?: RepeatMode }): PlaylistManager {
    const mgr = new PlaylistManager();
    const items = (data.items || []).map((d) => ({ ...d }));
    mgr.items = items as PlaylistItem[];
    mgr.index = typeof data.index === 'number' ? data.index! : (items.length ? 0 : -1);
    mgr.shuffle = !!data.shuffle;
    mgr.repeat = data.repeat || 'off';
    mgr.playedSet.clear();
    if (mgr.index >= 0) mgr.playedSet.add(mgr.index);
    mgr.history = mgr.index >= 0 ? [mgr.index] : [];
    return mgr;
  }
}