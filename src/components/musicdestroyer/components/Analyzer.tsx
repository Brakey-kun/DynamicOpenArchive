"use client";
import { useEffect, useRef } from 'react';
import { AudioEngine } from '../utils/audioGraph';

type Props = {
  engine: AudioEngine | null;
  playing: boolean;
};

export default function Analyzer({ engine, playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const analyser = engine?.analyser;
    if (!canvas || !ctx || !analyser) return;

    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(15,20,27,0.85)';
      ctx.fillRect(0, 0, w, h);
      const barWidth = (w / bufferLength) * 1.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i];
        const barHeight = (v / 255) * h;
        ctx.fillStyle = 'rgba(0, 231, 255, 0.6)';
        ctx.fillRect(x, h - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    if (playing) draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [engine, playing]);

  return (
    <div className="panel p-4 mt-6">
      <h3 className="grid-label mb-2">Analyzer</h3>
      <div className="w-full h-32">
        <canvas ref={canvasRef} width={1000} height={128} className="w-full h-full" />
      </div>
    </div>
  );
}