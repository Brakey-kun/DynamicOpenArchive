"use client";
type Props = {
  onFile: (file: File) => void;
};

export default function ImportButton({ onFile }: Props) {
  const id = 'md-import-file';
  const onClick = () => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.click();
  };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="file" accept=".mp3,.ogg,.m4a,.flac,.wav,audio/*" onChange={onChange} className="hidden" />
      <button className="btn btn-primary" onClick={onClick} aria-label="Import audio">Import</button>
    </div>
  );
}