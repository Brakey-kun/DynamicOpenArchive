"use client";

export default function Header() {
  return (
    <header className="w-full bg-slate-900 border-b border-slate-800">
      <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center justify-between">
        <div className="text-slate-200 font-semibold">Music Destroyer</div>
        <div className="text-slate-400 text-sm">Experimental audio playground</div>
      </div>
    </header>
  );
}