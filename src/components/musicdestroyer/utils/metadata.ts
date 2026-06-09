import { parseBlob } from 'music-metadata-browser';

export type ParsedInfo = {
  container?: string;
  bitrateKbps?: number | 'Unknown';
  bitDepth?: number | 'Unknown';
  sampleRate?: number;
  channels?: number;
  duration?: number;
  vbr?: boolean | undefined;
};

const SUPPORTED_EXT = ['mp3', 'ogg', 'm4a', 'flac', 'wav', 'webm', 'mp4'];

export function isSupported(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return !!ext && SUPPORTED_EXT.includes(ext);
}

export async function parseMetadata(
  file: File,
  fallback?: { sampleRate?: number; duration?: number; channels?: number }
): Promise<ParsedInfo> {
  try {
    const mm = await parseBlob(file);
    const fmt = mm.format || {};
    const bitrateKbps = typeof fmt.bitrate === 'number' ? Math.round(fmt.bitrate / 1000) : 'Unknown';
    const sampleRate = fmt.sampleRate ?? fallback?.sampleRate;
    const channels = fmt.numberOfChannels ?? fallback?.channels;
    const duration = fmt.duration ?? fallback?.duration;
    const bitDepth = typeof fmt.bitsPerSample === 'number' ? fmt.bitsPerSample : 'Unknown';
    const container = fmt.container || (Array.isArray(fmt.tagTypes) ? fmt.tagTypes[0] : undefined);
    const vbr = fmt.lossless ? false : undefined;
    return { container, bitrateKbps, bitDepth, sampleRate, channels, duration, vbr };
  } catch (e) {
    console.warn('metadata parse failed, using fallback', e);
    return {
      bitrateKbps: 'Unknown',
      bitDepth: 'Unknown',
      sampleRate: fallback?.sampleRate,
      channels: fallback?.channels,
      duration: fallback?.duration,
    };
  }
}