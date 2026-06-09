import { useEffect } from 'react';

type Settings = Record<string, number | boolean | undefined>;

export function useLocalSettings(settings: Settings, apply: (s: Settings) => void) {
  // Load on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('musicdestroyer-settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') apply(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem('musicdestroyer-settings', JSON.stringify(settings));
    } catch {}
  }, [settings]);
}