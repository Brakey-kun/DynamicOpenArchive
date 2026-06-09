import { SaveData } from './entities';

const KEY = 'octashotSave';

export function defaultSave(): SaveData {
  return {
    level: 1,
    stats: { 
      kills: 0, bosses: 0, shots: 0, score: 0,
      items: { heart: 0, apple: 0, shield: 0, sniper: 0, skin: 0, freeze: 0, reflector: 0, siphon: 0, piercer: 0, burst: 0 }
    },
    maxHp: 20,
    hp: 20,
    skins: ['default'],
    selectedSkin: 'default',
    sniperUses: 0,
    maxLevel: 1,
    maxKills: 0,
    maxBosses: 0,
    maxScore: 0,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const base = defaultSave();
    const merged: SaveData = { ...base, ...data } as SaveData;
    merged.stats = { ...base.stats, ...(data.stats || {}) };
    merged.stats.items = { ...base.stats.items, ...((data.stats && data.stats.items) || {}) };
    merged.maxLevel = merged.maxLevel ?? base.maxLevel;
    merged.maxKills = merged.maxKills ?? base.maxKills;
    merged.maxBosses = merged.maxBosses ?? base.maxBosses;
    merged.maxScore = merged.maxScore ?? base.maxScore;
    return merged;
  } catch {
    return defaultSave();
  }
}

export function save(data: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export function exportJSON(data: SaveData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'octashot-save.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importJSON(file: File): Promise<SaveData> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result));
        const base = defaultSave();
        const merged: SaveData = { ...base, ...data } as SaveData;
        merged.stats = { ...base.stats, ...(data.stats || {}) };
        merged.stats.items = { ...base.stats.items, ...((data.stats && data.stats.items) || {}) };
        merged.maxLevel = merged.maxLevel ?? base.maxLevel;
        merged.maxKills = merged.maxKills ?? base.maxKills;
        merged.maxBosses = merged.maxBosses ?? base.maxBosses;
        merged.maxScore = merged.maxScore ?? base.maxScore;
        resolve(merged);
      } catch (e) { reject(e); }
    };
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}