"use client";
import { useEffect, useRef, useState } from 'react';
import { AudioEngine } from './utils/audioGraph';
import { isSupported, parseMetadata, type ParsedInfo } from './utils/metadata';
import Header from './components/Header';
import Footer from './components/Footer';
import SectionCard from './components/SectionCard';
import FileDrop from './components/FileDrop';
import InfoCard from './components/InfoCard';
import SliderControl from './components/SliderControl';
import Transport from './components/Transport';
import Analyzer from './components/Analyzer';
import { useLocalSettings } from './components/useLocalSettings';
import ImportButton from './components/ImportButton';
import ExportButton from './components/ExportButton';
import { encodeWAVFromAudioBuffer, triggerDownload } from './utils/export';
import { PlaylistManager, type PlaylistItem, type RepeatMode } from './utils/playlist';

function App() {
  const engineRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number | null>(null);

  const [fileName, setFileName] = useState<string>('No file loaded');
  const [info, setInfo] = useState<ParsedInfo | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const [playing, setPlaying] = useState<boolean>(false);
  const [bypass, setBypass] = useState<boolean>(false);
  const [dither, setDither] = useState<boolean>(false);

  const [bitrate, setBitrate] = useState<number>(320);
  const [bitdepth, setBitdepth] = useState<number>(24);
  const [maxfreq, setMaxfreq] = useState<number>(22050);
  const [speed, setSpeed] = useState<number>(1.0);
  const [pan, setPan] = useState<number>(0);
  const [highpass, setHighpass] = useState<number>(0);
  const [reverb, setReverb] = useState<number>(0);
  const [downsample, setDownsample] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [muted, setMuted] = useState<boolean>(false);
  // Creative FX
  const [alien, setAlien] = useState<number>(0);
  const [underwater, setUnderwater] = useState<number>(0);
  const [gurgle, setGurgle] = useState<number>(0);
  // Modulation & Space
  const [tremoloDepth, setTremoloDepth] = useState<number>(0);
  const [tremoloRate, setTremoloRate] = useState<number>(2);
  const [chorusMix, setChorusMix] = useState<number>(0);
  const [chorusDepthMs, setChorusDepthMs] = useState<number>(0);
  const [chorusRate, setChorusRate] = useState<number>(1);
  const [delayTimeMs, setDelayTimeMs] = useState<number>(250);
  const [delayFeedback, setDelayFeedback] = useState<number>(0);
  const [delayMix, setDelayMix] = useState<number>(0);
  // Reverb shape
  const [reverbSizeSec, setReverbSizeSec] = useState<number>(2.0);
  const [reverbDecay, setReverbDecay] = useState<number>(0.85);
  // Filter Q
  const [lowpassQ, setLowpassQ] = useState<number>(0.707);
  const [highpassQ, setHighpassQ] = useState<number>(0.707);
  const [toast, setToast] = useState<string>('');
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [playlistIndex, setPlaylistIndex] = useState<number>(-1);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const playlistRef = useRef<PlaylistManager>(new PlaylistManager());

  useEffect(() => {
    engineRef.current = new AudioEngine();
    // Auto-advance when track ends according to playlist rules
    engineRef.current.onEnded = () => {
      console.log('[App] onEnded fired');
      const mgr = playlistRef.current;
      const next = mgr.nextIndex();
      console.log('[App] nextIndex', { next, shuffle: mgr.shuffle, repeat: mgr.repeat });
      if (next === null) {
        setPlaying(false);
        return;
      }
      mgr.applySelection(next);
      setPlaylistIndex(next);
      const item = mgr.getCurrent();
      console.log('[App] auto-advance selection', { index: next, name: item?.name });
      if (item?.file) handleFiles(item.file);
    };
    const loop = () => {
      const eng = engineRef.current!;
      const t = eng.getCurrentTime();
      setCurrentTime(t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState<boolean>(false);
  const handleFiles = async (file: File) => {
    if (!isSupported(file)) {
      alert('Unsupported file format. Please use MP3, OGG, M4A, FLAC, or WAV.');
      return;
    }
    console.log('[App] handleFiles begin', { name: file.name });
    setFileName(file.name);
    setLoading(true);
    const eng = engineRef.current!;
    const state = await eng.loadFile(file);
    console.log('[App] handleFiles loaded', { duration: state.duration, sampleRate: state.sampleRate, channels: state.channels });
    const meta = await parseMetadata(file, { sampleRate: state.sampleRate, duration: state.duration, channels: state.channels });
    console.log('[App] metadata parsed', { duration: meta.duration, sampleRate: meta.sampleRate, channels: meta.channels, bitrateKbps: meta.bitrateKbps });
    setInfo(meta);
    // Robust duration fallback: prefer decoded duration, else metadata duration
    const decodedDur = typeof state.duration === 'number' && isFinite(state.duration) ? state.duration : 0;
    const metaDur = typeof meta.duration === 'number' && isFinite(meta.duration) ? meta.duration : 0;
    const finalDur = decodedDur > 0 ? decodedDur : metaDur;
    setDuration(finalDur);
    // clamp maxfreq to nyquist
    const nyq = state.nyquist;
    setMaxfreq(nyq);
    eng.updateMaxFrequency(nyq);
    // Reapply last-known controls in correct order
    eng.updateBitDepth(bitdepth, dither);
    eng.updateDownsampleFactor(downsample);
    eng.updateReverbWet(reverb);
    eng.updateBitrateFeel(bitrate);
    eng.updateHighpass(highpass);
    eng.updatePan(pan);
    eng.updatePlaybackRate(speed);
    eng.updateVolume(volume);
    eng.setMuted(muted);
    // Creative FX
    eng.updateAlienVoice(alien);
    eng.updateUnderwater(underwater);
    eng.updateGurgle(gurgle);
    // Modulation & Space
    eng.updateTremoloDepth(tremoloDepth);
    eng.updateTremoloRate(tremoloRate);
    eng.updateChorusMix(chorusMix);
    eng.updateChorusDepth(chorusDepthMs);
    eng.updateChorusRate(chorusRate);
    eng.updateDelayTime(delayTimeMs);
    eng.updateDelayFeedback(delayFeedback);
    eng.updateDelayMix(delayMix);
    // Reverb shape & Filter Q
    eng.updateReverbParams({ sizeSec: reverbSizeSec, decay: reverbDecay });
    eng.updateLowpassQ(lowpassQ);
    eng.updateHighpassQ(highpassQ);
    setPlaying(true);
    setLoading(false);
    console.log('[App] handleFiles applied settings and started playback');
  };

  const togglePlay = () => {
    const eng = engineRef.current!;
    if (!playing) {
      console.log('[App] togglePlay → play');
      eng.play();
      setPlaying(true);
    } else {
      console.log('[App] togglePlay → pause');
      eng.pause();
      setPlaying(false);
    }
  };

  const toggleDither = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setDither(checked);
    engineRef.current?.updateBitDepth(bitdepth, checked);
  };

  const resetOriginal = () => {
    const eng = engineRef.current!;
    const nyq = eng.getState()?.nyquist ?? 22050;
    // Keep processing chain engaged but neutral
    setBypass(false);
    eng.setBypass(false);
    setBitrate(320);
    eng.updateBitrateFeel(320);
    setBitdepth(24);
    eng.updateBitDepth(24, false);
    setDither(false);
    setMaxfreq(nyq);
    eng.updateMaxFrequency(nyq);
    setSpeed(1.0); eng.updatePlaybackRate(1.0);
    setPan(0); eng.updatePan(0);
    setHighpass(0); eng.updateHighpass(0);
    setReverb(0); eng.updateReverbWet(0);
    setDownsample(1); eng.updateDownsampleFactor(1);
    setVolume(1); eng.updateVolume(1);
    setMuted(false); eng.setMuted(false);
    setAlien(0); eng.updateAlienVoice(0);
    setUnderwater(0); eng.updateUnderwater(0);
    setGurgle(0); eng.updateGurgle(0);
    // Modulation & Space — zero any amounts
    setTremoloDepth(0); eng.updateTremoloDepth(0);
    setTremoloRate(2); eng.updateTremoloRate(2);
    setChorusMix(0); eng.updateChorusMix(0);
    setChorusDepthMs(0); eng.updateChorusDepth(0);
    setChorusRate(1); eng.updateChorusRate(1);
    setDelayTimeMs(250); eng.updateDelayTime(250);
    setDelayFeedback(0); eng.updateDelayFeedback(0);
    setDelayMix(0); eng.updateDelayMix(0);
    // Reverb shape & Filter Q — keep default neutral shapes
    setReverbSizeSec(2.0); setReverbDecay(0.85);
    eng.updateReverbParams({ sizeSec: 2.0, decay: 0.85 });
    setLowpassQ(0.707); eng.updateLowpassQ(0.707);
    setHighpassQ(0.707); eng.updateHighpassQ(0.707);
  };

  // Persist settings to local storage and load on mount
  useLocalSettings({ bitrate, bitdepth, maxfreq, speed, pan, highpass, reverb, downsample, dither, bypass, volume, muted, alien, underwater, gurgle, tremoloDepth, tremoloRate, chorusMix, chorusDepthMs, chorusRate, delayTimeMs, delayFeedback, delayMix, reverbSizeSec, reverbDecay, lowpassQ, highpassQ }, (s) => {
    // Apply dither first so bit depth restoration uses the correct flag
    if (typeof s.dither === 'boolean') { setDither(s.dither); }

    if (typeof s.bitrate === 'number') { setBitrate(s.bitrate); engineRef.current?.updateBitrateFeel(s.bitrate); }
    if (typeof s.bitdepth === 'number') { setBitdepth(s.bitdepth); engineRef.current?.updateBitDepth(s.bitdepth, (typeof s.dither === 'boolean' ? s.dither : dither)); }

    if (typeof s.maxfreq === 'number') {
      const nyq = engineRef.current?.getState()?.nyquist ?? (engineRef.current?.context.sampleRate ?? 44100) / 2;
      const clamped = Math.max(1, Math.min(s.maxfreq, nyq));
      setMaxfreq(clamped);
      engineRef.current?.updateMaxFrequency(clamped);
    }

    if (typeof s.speed === 'number') { setSpeed(s.speed); engineRef.current?.updatePlaybackRate(s.speed); }
    if (typeof s.pan === 'number') { setPan(s.pan); engineRef.current?.updatePan(s.pan); }
    if (typeof s.highpass === 'number') { setHighpass(s.highpass); engineRef.current?.updateHighpass(s.highpass); }
    if (typeof s.reverb === 'number') { setReverb(s.reverb); engineRef.current?.updateReverbWet(s.reverb); }
    if (typeof s.downsample === 'number') { setDownsample(s.downsample); engineRef.current?.updateDownsampleFactor(s.downsample); }
    if (typeof s.bypass === 'boolean') { setBypass(s.bypass); engineRef.current?.setBypass(s.bypass); }
    if (typeof s.volume === 'number') { setVolume(s.volume); engineRef.current?.updateVolume(s.volume); }
    if (typeof s.muted === 'boolean') { setMuted(s.muted); engineRef.current?.setMuted(s.muted); }
    if (typeof s.alien === 'number') { setAlien(s.alien); engineRef.current?.updateAlienVoice(s.alien); }
    if (typeof s.underwater === 'number') { setUnderwater(s.underwater); engineRef.current?.updateUnderwater(s.underwater); }
    if (typeof s.gurgle === 'number') { setGurgle(s.gurgle); engineRef.current?.updateGurgle(s.gurgle); }
    // Modulation & Space
    if (typeof s.tremoloDepth === 'number') { setTremoloDepth(s.tremoloDepth); engineRef.current?.updateTremoloDepth(s.tremoloDepth); }
    if (typeof s.tremoloRate === 'number') { setTremoloRate(s.tremoloRate); engineRef.current?.updateTremoloRate(s.tremoloRate); }
    if (typeof s.chorusMix === 'number') { setChorusMix(s.chorusMix); engineRef.current?.updateChorusMix(s.chorusMix); }
    if (typeof s.chorusDepthMs === 'number') { setChorusDepthMs(s.chorusDepthMs); engineRef.current?.updateChorusDepth(s.chorusDepthMs); }
    if (typeof s.chorusRate === 'number') { setChorusRate(s.chorusRate); engineRef.current?.updateChorusRate(s.chorusRate); }
    if (typeof s.delayTimeMs === 'number') { setDelayTimeMs(s.delayTimeMs); engineRef.current?.updateDelayTime(s.delayTimeMs); }
    if (typeof s.delayFeedback === 'number') { setDelayFeedback(s.delayFeedback); engineRef.current?.updateDelayFeedback(s.delayFeedback); }
    if (typeof s.delayMix === 'number') { setDelayMix(s.delayMix); engineRef.current?.updateDelayMix(s.delayMix); }
    // Reverb shape & Filter Q
    if (typeof s.reverbSizeSec === 'number' || typeof s.reverbDecay === 'number') {
      const sizeSec = typeof s.reverbSizeSec === 'number' ? s.reverbSizeSec : reverbSizeSec;
      const decay = typeof s.reverbDecay === 'number' ? s.reverbDecay : reverbDecay;
      setReverbSizeSec(sizeSec);
      setReverbDecay(decay);
      engineRef.current?.updateReverbParams({ sizeSec, decay });
    }
    if (typeof s.lowpassQ === 'number') { setLowpassQ(s.lowpassQ); engineRef.current?.updateLowpassQ(s.lowpassQ); }
    if (typeof s.highpassQ === 'number') { setHighpassQ(s.highpassQ); engineRef.current?.updateHighpassQ(s.highpassQ); }
  });

  const onExport = async () => {
    try {
      const buf = await engineRef.current!.renderCurrentMix();
      const blob = encodeWAVFromAudioBuffer(buf);
      triggerDownload(blob, (fileName || 'mix') + '.wav');
      setToast('Exported current mix as WAV');
      setTimeout(() => setToast(''), 2000);
    } catch (e) {
      console.error(e);
      setToast('Failed to export');
      setTimeout(() => setToast(''), 2000);
    }
  };

  // Playlist persistence: store lightweight data only
  useEffect(() => {
    try {
      const data = playlistRef.current.serialize();
      localStorage.setItem('musicdestroyer-playlist', JSON.stringify({ ...data }));
    } catch {}
  }, [playlistItems, playlistIndex, shuffle, repeat]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('musicdestroyer-playlist');
      if (raw) {
        const parsed = JSON.parse(raw);
        const mgr = PlaylistManager.deserialize(parsed);
        playlistRef.current = mgr;
        setPlaylistItems(mgr.items);
        setPlaylistIndex(mgr.index);
        setShuffle(mgr.shuffle);
        setRepeat(mgr.repeat);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const applySelection = async (index: number) => {
    const mgr = playlistRef.current;
    console.log('[App] applySelection', { index });
    mgr.applySelection(index);
    setPlaylistIndex(index);
    const item = mgr.getCurrent();
    if (!item?.file) {
      setToast('File not available. Please re-import the folder.');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    console.log('[App] applySelection loading', { name: item.name });
    await handleFiles(item.file);
    // Preload next track's metadata (if missing)
    const next = mgr.nextIndex();
    if (next !== null) {
      const nItem = mgr.items[next];
      if (nItem?.file && typeof nItem.duration !== 'number') {
        parseMetadata(nItem.file).then((m) => {
          setPlaylistItems((prev) => {
            const copy = prev.slice();
            const at = copy.findIndex((p) => p.id === nItem.id);
            if (at >= 0) copy[at] = { ...copy[at], duration: m.duration, sampleRate: m.sampleRate, channels: m.channels, bitrateKbps: m.bitrateKbps };
            playlistRef.current.items = copy.slice();
            return copy;
          });
          console.log('[App] preloaded metadata for next', { name: nItem.name, next });
        }).catch(() => {});
      }
    }
  };

  const onPrev = async () => {
    const mgr = playlistRef.current;
    const prev = mgr.prevIndex();
    if (prev === null) return;
    await applySelection(prev);
  };
  const onNext = async () => {
    const mgr = playlistRef.current;
    const next = mgr.nextIndex();
    if (next === null) return;
    await applySelection(next);
  };

  const onShuffleChange = (on: boolean) => {
    setShuffle(on);
    playlistRef.current.setShuffle(on);
  };
  const onRepeatChange = (mode: RepeatMode) => {
    setRepeat(mode);
    playlistRef.current.setRepeat(mode);
  };

  // Presets and fun helpers
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const applyPreset = (name: string) => {
    const eng = engineRef.current!;
    const nyq = eng.getState()?.nyquist ?? (eng.context.sampleRate / 2);
    switch (name) {
      case 'Broken Radio': {
        const preset = {
          dither: false,
          bitdepth: 8,
          downsample: 16,
          bitrate: 32,
          highpass: 600,
          reverb: 0.2,
          pan: -0.2,
          maxfreq: 8000,
          speed: 1.0,
        };
        setDither(preset.dither);
        eng.updateBitDepth(preset.bitdepth, preset.dither);
        setBitdepth(preset.bitdepth);
        setDownsample(preset.downsample); eng.updateDownsampleFactor(preset.downsample);
        setBitrate(preset.bitrate); eng.updateBitrateFeel(preset.bitrate);
        setHighpass(preset.highpass); eng.updateHighpass(preset.highpass);
        setReverb(preset.reverb); eng.updateReverbWet(preset.reverb);
        setPan(preset.pan); eng.updatePan(preset.pan);
        const mf = clamp(preset.maxfreq, 1000, nyq);
        setMaxfreq(mf); eng.updateMaxFrequency(mf);
        setSpeed(preset.speed); eng.updatePlaybackRate(preset.speed);
        break;
      }
      case '8-bit Handheld': {
        const preset = {
          dither: false,
          bitdepth: 5,
          downsample: 2,
          bitrate: 80,
          highpass: 200,
          reverb: 0.05,
          pan: 0,
          maxfreq: 9000,
          speed: 1.0,
        };
        setDither(preset.dither);
        eng.updateBitDepth(preset.bitdepth, preset.dither);
        setBitdepth(preset.bitdepth);
        setDownsample(preset.downsample); eng.updateDownsampleFactor(preset.downsample);
        setBitrate(preset.bitrate); eng.updateBitrateFeel(preset.bitrate);
        setHighpass(preset.highpass); eng.updateHighpass(preset.highpass);
        setReverb(preset.reverb); eng.updateReverbWet(preset.reverb);
        setPan(preset.pan); eng.updatePan(preset.pan);
        const mf = clamp(preset.maxfreq, 1000, nyq);
        setMaxfreq(mf); eng.updateMaxFrequency(mf);
        setSpeed(preset.speed); eng.updatePlaybackRate(preset.speed);
        break;
      }
      case 'Cassette Melt': {
        const preset = {
          dither: true,
          bitdepth: 13,
          downsample: 1,
          bitrate: 112,
          highpass: 120,
          reverb: 0.4,
          pan: 0,
          maxfreq: 16000,
          speed: 0.98,
        };
        setDither(preset.dither);
        eng.updateBitDepth(preset.bitdepth, preset.dither);
        setBitdepth(preset.bitdepth);
        setDownsample(preset.downsample); eng.updateDownsampleFactor(preset.downsample);
        setBitrate(preset.bitrate); eng.updateBitrateFeel(preset.bitrate);
        setHighpass(preset.highpass); eng.updateHighpass(preset.highpass);
        setReverb(preset.reverb); eng.updateReverbWet(preset.reverb);
        setPan(preset.pan); eng.updatePan(preset.pan);
        const mf = clamp(preset.maxfreq, 1000, nyq);
        setMaxfreq(mf); eng.updateMaxFrequency(mf);
        setSpeed(preset.speed); eng.updatePlaybackRate(preset.speed);
        break;
      }
      case 'Underwater Club': {
        const preset = {
          dither: true,
          bitdepth: 12,
          downsample: 8,
          bitrate: 48,
          highpass: 100,
          reverb: 0.6,
          pan: 0,
          maxfreq: 6000,
          speed: 1.0,
        };
        setDither(preset.dither);
        eng.updateBitDepth(preset.bitdepth, preset.dither);
        setBitdepth(preset.bitdepth);
        setDownsample(preset.downsample); eng.updateDownsampleFactor(preset.downsample);
        setBitrate(preset.bitrate); eng.updateBitrateFeel(preset.bitrate);
        setHighpass(preset.highpass); eng.updateHighpass(preset.highpass);
        setReverb(preset.reverb); eng.updateReverbWet(preset.reverb);
        setPan(preset.pan); eng.updatePan(preset.pan);
        const mf = clamp(preset.maxfreq, 1000, nyq);
        setMaxfreq(mf); eng.updateMaxFrequency(mf);
        setSpeed(preset.speed); eng.updatePlaybackRate(preset.speed);
        break;
      }
      case 'Phone Line': {
        const preset = {
          dither: false,
          bitdepth: 8,
          downsample: 4,
          bitrate: 28,
          highpass: 300,
          reverb: 0.1,
          pan: 0,
          maxfreq: 3500,
          speed: 1.0,
        };
        setDither(preset.dither);
        eng.updateBitDepth(preset.bitdepth, preset.dither);
        setBitdepth(preset.bitdepth);
        setDownsample(preset.downsample); eng.updateDownsampleFactor(preset.downsample);
        setBitrate(preset.bitrate); eng.updateBitrateFeel(preset.bitrate);
        setHighpass(preset.highpass); eng.updateHighpass(preset.highpass);
        setReverb(preset.reverb); eng.updateReverbWet(preset.reverb);
        setPan(preset.pan); eng.updatePan(preset.pan);
        const mf = clamp(preset.maxfreq, 1000, nyq);
        setMaxfreq(mf); eng.updateMaxFrequency(mf);
        setSpeed(preset.speed); eng.updatePlaybackRate(preset.speed);
        break;
      }
      default:
        break;
    }
  };

  const chaos = () => {
    const eng = engineRef.current!;
    const nyq = eng.getState()?.nyquist ?? (eng.context.sampleRate / 2);
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const randi = (min: number, max: number) => Math.round(rand(min, max));
    const ditherFlag = Math.random() < 0.5;
    const bd = randi(6, 16);
    const ds = randi(1, 32);
    const wet = clamp(rand(0, 0.6), 0, 1);
    const kbps = randi(24, 160);
    const p = clamp(rand(-0.4, 0.4), -1, 1);
    const hp = randi(0, 800);
    const mf = clamp(randi(5000, 16000), 1000, nyq);
    setDither(ditherFlag);
    eng.updateBitDepth(bd, ditherFlag);
    setBitdepth(bd);
    setDownsample(ds); eng.updateDownsampleFactor(ds);
    setReverb(wet); eng.updateReverbWet(wet);
    setBitrate(kbps); eng.updateBitrateFeel(kbps);
    setPan(p); eng.updatePan(p);
    setHighpass(hp); eng.updateHighpass(hp);
    setMaxfreq(mf); eng.updateMaxFrequency(mf);
  };

  return (
    <div className="min-h-screen w-full bg-bg">
      <Header />

      <main className={"mx-auto max-w-[1200px] px-4"}>
        {/* Top toolbar */}
        <SectionCard className="flex items-center gap-4">
          <ImportButton onFile={handleFiles} />
          <div className="ml-auto text-slate-300 text-sm truncate" aria-label="Current track name">{fileName}</div>
          <ExportButton onExport={onExport} disabled={!engineRef.current?.getState()} />
        </SectionCard>

        {/* Source file & Info */}
        <SectionCard className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="grid gap-6">
            <FileDrop onFile={handleFiles} fileName={fileName} loading={loading} />
          </div>
          <InfoCard data={{
            bitrateKbps: info?.bitrateKbps,
            bitDepth: info?.bitDepth,
            sampleRate: info?.sampleRate,
            channels: info?.channels,
            duration: info?.duration,
          }} />
        </SectionCard>

        {/* Controls */}
        <SectionCard title="Core Quality" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <SliderControl
            label="Bitrate Feel"
            min={1}
            max={320}
            step={1}
            value={bitrate}
            onChange={(kbps) => { setBitrate(kbps); engineRef.current?.updateBitrateFeel(kbps); }}
            format={(v) => `${v} kbps`}
            title="psychoacoustic approximation"
          />

          <div className="grid gap-1">
            <SliderControl
              label="Bit Depth"
              min={4}
              max={24}
              step={1}
              value={bitdepth}
              onChange={(bits) => { setBitdepth(bits); engineRef.current?.updateBitDepth(bits, dither); }}
              format={(v) => `${v}-bit`}
              title="quantization"
            />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={dither} onChange={toggleDither} aria-label="TPDF dither" />
              TPDF dither
            </label>
          </div>

          <SliderControl
            label="Max Frequency"
            min={1000}
            max={22050}
            step={1}
            value={maxfreq}
            onChange={(hz) => { setMaxfreq(hz); engineRef.current?.updateMaxFrequency(hz); }}
            format={(v) => `${Math.round(v)} Hz`}
            title="low-pass cap"
          />
          <SliderControl
            label="Lowpass Q"
            min={0.5}
            max={2.5}
            step={0.01}
            value={lowpassQ}
            onChange={(q) => { setLowpassQ(q); engineRef.current?.updateLowpassQ(q); }}
            format={(v) => v.toFixed(2)}
            title="resonance for max low-pass"
          />
        </SectionCard>

        <Transport
          playing={playing}
          onPlayPause={togglePlay}
          onReset={resetOriginal}
          bypass={bypass}
          onBypass={(checked) => { setBypass(checked); engineRef.current?.setBypass(checked); }}
          currentTime={currentTime}
          duration={duration}
          onSeek={(s) => engineRef.current?.seek(s)}
          onPrev={onPrev}
          onNext={onNext}
          shuffle={shuffle}
          onShuffleChange={onShuffleChange}
          repeatMode={repeat}
          onRepeatChange={onRepeatChange}
          currentTrackName={fileName}
          upcomingCount={playlistRef.current.upcomingCount()}
        />

        {/* Playback Controls */}
        <SectionCard title="Playback" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <SliderControl
            label="Speed"
            min={0.5}
            max={2.0}
            step={0.01}
            value={speed}
            onChange={(v) => { setSpeed(v); engineRef.current?.updatePlaybackRate(v); }}
            format={(v) => `${v.toFixed(2)}x`}
            title="playbackRate (changes pitch)"
          />

          <div className="grid gap-1">
            <SliderControl
              label="Volume"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(v) => { setVolume(v); engineRef.current?.updateVolume(v); }}
              format={(v) => `${Math.round(v * 100)}%`}
              title="master gain"
            />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={muted} onChange={(e) => { const on = e.target.checked; setMuted(on); engineRef.current?.setMuted(on); }} aria-label="Mute output" />
              Mute
            </label>
          </div>

          <SliderControl
            label="Pan"
            min={-1}
            max={1}
            step={0.01}
            value={pan}
            onChange={(v) => { setPan(v); engineRef.current?.updatePan(v); }}
            format={(v) => v.toFixed(2)}
            title="stereo panner"
          />

          <SliderControl
            label="Highpass"
            min={0}
            max={2000}
            step={1}
            value={highpass}
            onChange={(hz) => { setHighpass(hz); engineRef.current?.updateHighpass(hz); }}
            format={(v) => `${Math.round(v)} Hz`}
            title="remove lows"
          />
          <SliderControl
            label="Highpass Q"
            min={0.5}
            max={2.0}
            step={0.01}
            value={highpassQ}
            onChange={(q) => { setHighpassQ(q); engineRef.current?.updateHighpassQ(q); }}
            format={(v) => v.toFixed(2)}
            title="resonance at cutoff"
          />
        </SectionCard>

        <SectionCard className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <SliderControl
            label="Reverb (Wet)"
            min={0}
            max={1}
            step={0.01}
            value={reverb}
            onChange={(v) => { setReverb(v); engineRef.current?.updateReverbWet(v); }}
            format={(v) => v.toFixed(2)}
            title="simple room reverb"
          />
          <SliderControl
            label="Reverb Size"
            min={0.5}
            max={4.0}
            step={0.01}
            value={reverbSizeSec}
            onChange={(sec) => { setReverbSizeSec(sec); engineRef.current?.updateReverbParams({ sizeSec: sec, decay: reverbDecay }); }}
            format={(v) => `${v.toFixed(2)} s`}
            title="IR length"
          />
          <SliderControl
            label="Reverb Decay"
            min={0.3}
            max={0.95}
            step={0.01}
            value={reverbDecay}
            onChange={(d) => { setReverbDecay(d); engineRef.current?.updateReverbParams({ sizeSec: reverbSizeSec, decay: d }); }}
            format={(v) => v.toFixed(2)}
            title="tail damping"
          />

          <SliderControl
            label="Downsample"
            min={1}
            max={64}
            step={1}
            value={downsample}
            onChange={(f) => { setDownsample(f); engineRef.current?.updateDownsampleFactor(f); }}
            format={(v) => `x${v}`}
            title="sample & hold"
          />
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-slate-200 text-sm">Presets & Fun</div>
                <div className="text-slate-500 text-xs">one-click vibes + chaos</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Broken Radio','8-bit Handheld','Cassette Melt','Underwater Club','Phone Line'].map((name) => (
                <button
                  key={name}
                  className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                  onClick={() => applyPreset(name)}
                  aria-label={`Apply preset ${name}`}
                >{name}</button>
              ))}
              <button
                className="px-3 py-2 rounded bg-cyan-800 hover:bg-cyan-700 text-cyan-100 text-xs"
                onClick={chaos}
                aria-label="Chaos randomizer"
              >Chaos</button>
            </div>
          </div>
        </SectionCard>

        {/* Creative FX (placed above Analyzer) */}
        <SectionCard title="Creative FX" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <SliderControl
            label="Alien Voice"
            min={0}
            max={1}
            step={0.01}
            value={alien}
            onChange={(v) => { setAlien(v); engineRef.current?.updateAlienVoice(v); }}
            format={(v) => v.toFixed(2)}
            title="ring modulation"
          />

          <SliderControl
            label="Underwater"
            min={0}
            max={1}
            step={0.01}
            value={underwater}
            onChange={(v) => { setUnderwater(v); engineRef.current?.updateUnderwater(v); }}
            format={(v) => v.toFixed(2)}
            title="muffled low-pass"
          />

          <SliderControl
            label="Gurgle"
            min={0}
            max={1}
            step={0.01}
            value={gurgle}
            onChange={(v) => { setGurgle(v); engineRef.current?.updateGurgle(v); }}
            format={(v) => v.toFixed(2)}
            title="band-pass LFO"
          />
        </SectionCard>

        {/* Modulation & Space */}
        <SectionCard title="Modulation & Space" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* Tremolo */}
          <SliderControl
            label="Tremolo Depth"
            min={0}
            max={1}
            step={0.01}
            value={tremoloDepth}
            onChange={(v) => { setTremoloDepth(v); engineRef.current?.updateTremoloDepth(v); }}
            format={(v) => v.toFixed(2)}
            title="modulates amplitude"
          />
          <SliderControl
            label="Tremolo Rate"
            min={0.5}
            max={10}
            step={0.01}
            value={tremoloRate}
            onChange={(v) => { setTremoloRate(v); engineRef.current?.updateTremoloRate(v); }}
            format={(v) => `${v.toFixed(2)} Hz`}
            title="speed of pulsation"
          />

          {/* Chorus */}
          <SliderControl
            label="Chorus Mix"
            min={0}
            max={1}
            step={0.01}
            value={chorusMix}
            onChange={(v) => { setChorusMix(v); engineRef.current?.updateChorusMix(v); }}
            format={(v) => v.toFixed(2)}
            title="blend detuned copy"
          />
          <SliderControl
            label="Chorus Depth"
            min={0}
            max={10}
            step={0.1}
            value={chorusDepthMs}
            onChange={(v) => { setChorusDepthMs(v); engineRef.current?.updateChorusDepth(v); }}
            format={(v) => `${v.toFixed(1)} ms`}
            title="delay modulation amount"
          />
          <SliderControl
            label="Chorus Rate"
            min={0.2}
            max={5}
            step={0.01}
            value={chorusRate}
            onChange={(v) => { setChorusRate(v); engineRef.current?.updateChorusRate(v); }}
            format={(v) => `${v.toFixed(2)} Hz`}
            title="LFO speed"
          />

          {/* Delay/Echo */}
          <SliderControl
            label="Delay Time"
            min={10}
            max={1000}
            step={1}
            value={delayTimeMs}
            onChange={(v) => { setDelayTimeMs(v); engineRef.current?.updateDelayTime(v); }}
            format={(v) => `${Math.round(v)} ms`}
            title="slapback to echo"
          />
          <SliderControl
            label="Delay Feedback"
            min={0}
            max={0.8}
            step={0.01}
            value={delayFeedback}
            onChange={(v) => { setDelayFeedback(v); engineRef.current?.updateDelayFeedback(v); }}
            format={(v) => v.toFixed(2)}
            title="number of repeats"
          />
          <SliderControl
            label="Delay Mix"
            min={0}
            max={1}
            step={0.01}
            value={delayMix}
            onChange={(v) => { setDelayMix(v); engineRef.current?.updateDelayMix(v); }}
            format={(v) => v.toFixed(2)}
            title="wet/dry balance"
          />
        </SectionCard>

        <Analyzer engine={engineRef.current} playing={playing} />

      </main>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className="px-4 py-2 rounded-lg bg-slate-800/90 border border-cyan-400/40 text-slate-200 shadow-lg">
            {toast}
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}

export default App;