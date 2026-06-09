type Props = {
  data: {
    bitrateKbps?: number | 'Unknown';
    bitDepth?: number | 'Unknown';
    sampleRate?: number;
    channels?: number;
    duration?: number;
  };
};

function fmtDuration(sec?: number) {
  if (!sec && sec !== 0) return '—';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function InfoCard({ data }: Props) {
  return (
    <div className="panel p-6">
      <h3 className="grid-label mb-3">Detected Source Info</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="text-slate-400">Bitrate</div>
        <div className="text-slate-200">{typeof data.bitrateKbps === 'number' ? `${data.bitrateKbps} kbps` : (data.bitrateKbps ?? '—')}</div>
        <div className="text-slate-400">Bit Depth</div>
        <div className="text-slate-200">{typeof data.bitDepth === 'number' ? `${data.bitDepth}-bit` : (data.bitDepth ?? '—')}</div>
        <div className="text-slate-400">Sample Rate</div>
        <div className="text-slate-200">{data.sampleRate ? `${Math.round(data.sampleRate)} Hz` : '—'}</div>
        <div className="text-slate-400">Channels</div>
        <div className="text-slate-200">{data.channels ?? '—'}</div>
        <div className="text-slate-400">Duration</div>
        <div className="text-slate-200">{fmtDuration(data.duration)}</div>
      </div>
    </div>
  );
}