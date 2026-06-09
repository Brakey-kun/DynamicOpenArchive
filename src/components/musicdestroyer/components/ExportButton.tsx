"use client";

type Props = {
  onExport: () => void;
  disabled?: boolean;
};

export default function ExportButton({ onExport, disabled }: Props) {
  return (
    <button className={`btn ${disabled ? 'opacity-50 cursor-not-allowed' : 'btn-primary'}`} onClick={onExport} disabled={!!disabled} aria-label="Export mix">
      Export WAV
    </button>
  );
}