"use client";
import { useCallback } from 'react';

type Props = {
  onFile: (file: File) => void;
  fileName: string;
  loading?: boolean;
};

export default function FileDrop({ onFile, fileName, loading }: Props) {
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }, [onFile]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`panel p-6 flex flex-col items-center justify-center text-center ${loading ? 'shimmer' : ''}`}
      aria-label="File dropzone"
    >
      <p className="text-slate-200">Drop an audio file here</p>
      <p className="text-slate-500 text-sm">Supported: MP3, OGG, M4A, FLAC, WAV</p>
      <div className="mt-4">
        <input
          type="file"
          accept=".mp3,.ogg,.m4a,.flac,.wav,audio/*"
          onChange={onChange}
          aria-label="Choose audio file"
          className="text-sm"
        />
      </div>
      <p className="mt-3 text-slate-400 text-sm">{fileName}</p>
    </div>
  );
}