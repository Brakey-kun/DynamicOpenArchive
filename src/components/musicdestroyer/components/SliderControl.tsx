"use client";
import * as Slider from '@radix-ui/react-slider';

type Props = {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  title?: string;
};

export default function SliderControl({ label, min, max, step = 1, value, onChange, format, title }: Props) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-slate-200 text-sm">{label}</div>
          {title && <div className="text-slate-500 text-xs">{title}</div>}
        </div>
        <div className="text-cyan-300 text-sm">{format ? format(value) : value}</div>
      </div>

      <Slider.Root
        className="relative flex items-center select-none touch-none h-5"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
      >
        <Slider.Track className="bg-slate-800 relative grow rounded-full h-2">
          <Slider.Range className="absolute h-full rounded-full bg-cyan-400" />
        </Slider.Track>
        <Slider.Thumb className="block w-4 h-4 rounded-full bg-cyan-300 accent-ring" aria-label={label} />
      </Slider.Root>
    </div>
  );
}