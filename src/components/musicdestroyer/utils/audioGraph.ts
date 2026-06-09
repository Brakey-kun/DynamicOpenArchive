/*
  AudioEngine: Web Audio graph for Dynamic Audio Quality Player
  - Decodes once (AudioBuffer) and rebuilds AudioBufferSourceNode on seek/play.
  - Real-time processing chain simulates bitrate feel (low-pass + gentle companding),
    bit depth via bitcrusher (AudioWorkletNode), and max frequency via low-pass filter.
  - Bypass mode routes directly to destination.
*/

import { addBitcrusherModule } from '../worklets/bitcrusher.worklet';

export type EngineState = {
  duration: number;
  sampleRate: number;
  channels: number;
  nyquist: number;
};

export class AudioEngine {
  context: AudioContext;
  analyser: AnalyserNode;
  masterGain: GainNode;
  source: AudioBufferSourceNode | null = null;
  buffer: AudioBuffer | null = null;
  onEnded?: () => void;

  // Processing chain
  bitcrusherNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  bitrateLowpass: BiquadFilterNode;
  highpass: BiquadFilterNode;
  artifactsShaper: WaveShaperNode;
  compressor: DynamicsCompressorNode;
  maxFreqLowpass: BiquadFilterNode;
  panner: StereoPannerNode;
  reverbGain: GainNode;
  convolver: ConvolverNode;
  // Creative FX
  underwaterLP: BiquadFilterNode;
  ringGain: GainNode;
  alienOsc: OscillatorNode;
  alienModGain: GainNode;
  gurgleBP: BiquadFilterNode;
  gurgleLFO: OscillatorNode;
  gurgleLFOGain: GainNode;
  // New modulation & space
  tremoloLFO: OscillatorNode;
  tremoloGain: GainNode;
  // Chorus (parallel send)
  chorusDelay: DelayNode;
  chorusLFO: OscillatorNode;
  chorusLFOGain: GainNode;
  chorusWet: GainNode;
  // Delay/Echo (parallel send)
  delayNode: DelayNode;
  delayFeedback: GainNode;
  delayWet: GainNode;

  // State
  playing = false;
  startContextTime = 0;
  startOffset = 0;
  bypass = false;
  workletReady = false;
  playbackRate = 1;
  volume = 1;
  muted = false;
  // Prevent auto-advance when stopping due to user actions (pause/seek/rebuild)
  private suppressOnEnded = false;
  // remember last applied settings to reapply when nodes (like worklet) become ready
  private lastBitDepth = 24;
  private lastDither = false;
  private lastDownsample = 1;
  // small epsilon to avoid starting exactly at buffer end (which triggers immediate end)
  private readonly epsilon = 0.001;

  constructor() {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 1;

    // Tremolo: LFO modulating masterGain.gain via a gain scaler
    this.tremoloLFO = this.context.createOscillator();
    this.tremoloLFO.type = 'sine';
    this.tremoloLFO.frequency.value = 2; // default rate ~2 Hz
    this.tremoloGain = this.context.createGain();
    this.tremoloGain.gain.value = 0; // depth 0 by default (disabled)
    this.tremoloLFO.connect(this.tremoloGain);
    this.tremoloGain.connect(this.masterGain.gain);
    try { this.tremoloLFO.start(); } catch {}

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;

    // Gentle low-pass tied to chosen kbps (psychoacoustic approximation)
    this.bitrateLowpass = this.context.createBiquadFilter();
    this.bitrateLowpass.type = 'lowpass';
    this.bitrateLowpass.frequency.value = 20000;
    this.bitrateLowpass.Q.value = 0.707;

    // Soft clip / artifact shaper using waveshaper (neutral by default)
    this.artifactsShaper = this.context.createWaveShaper();
    this.artifactsShaper.curve = this.makeSoftClipCurve(0.0);

    // Compander (neutral by default)
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = 0; // neutral threshold
    this.compressor.knee.value = 0;      // no knee
    this.compressor.ratio.value = 1;     // no compression
    this.compressor.attack.value = 0.001;
    this.compressor.release.value = 0.25;

    // Max frequency cap via low-pass (switch to allpass at Nyquist)
    this.maxFreqLowpass = this.context.createBiquadFilter();
    this.maxFreqLowpass.type = 'allpass';
    this.maxFreqLowpass.frequency.value = 22050;
    this.maxFreqLowpass.Q.value = 0.707;

    // Highpass to remove lows (switch to allpass at 0 Hz)
    this.highpass = this.context.createBiquadFilter();
    this.highpass.type = 'allpass';
    this.highpass.frequency.value = 0;
    this.highpass.Q.value = 0.707;

    // Stereo panner
    this.panner = this.context.createStereoPanner();
    this.panner.pan.value = 0;

    // Simple reverb bus (generated IR)
    this.reverbGain = this.context.createGain();
    this.reverbGain.gain.value = 0; // wet level
    this.convolver = this.context.createConvolver();
    this.convolver.normalize = true;
    this.convolver.buffer = this.makeNoiseIR(2.0, 0.85); // slightly longer decay for clearer wet audibility

    // Chorus send: very short delay with LFO modulation
    this.chorusDelay = this.context.createDelay(0.05); // allow up to 50ms
    this.chorusDelay.delayTime.value = 0.0; // baseline
    this.chorusLFO = this.context.createOscillator();
    this.chorusLFO.type = 'sine';
    this.chorusLFO.frequency.value = 1.0; // default ~1 Hz
    this.chorusLFOGain = this.context.createGain();
    this.chorusLFOGain.gain.value = 0.0; // depth 0 by default
    this.chorusWet = this.context.createGain();
    this.chorusWet.gain.value = 0.0; // mix 0 by default
    // Modulate delayTime
    this.chorusLFO.connect(this.chorusLFOGain);
    this.chorusLFOGain.connect(this.chorusDelay.delayTime);
    try { this.chorusLFO.start(); } catch {}

    // Delay/Echo send: feedback loop
    this.delayNode = this.context.createDelay(1.0); // up to 1s
    this.delayNode.delayTime.value = 0.25; // default ~250ms
    this.delayFeedback = this.context.createGain();
    this.delayFeedback.gain.value = 0.0; // default no repeats
    this.delayWet = this.context.createGain();
    this.delayWet.gain.value = 0.0; // mix 0 by default

    // Creative FX nodes (defaults to bypass behavior)
    // Underwater: strong low-pass muffle (neutral at amount=0)
    this.underwaterLP = this.context.createBiquadFilter();
    this.underwaterLP.type = 'allpass';
    this.underwaterLP.frequency.value = 20000;
    this.underwaterLP.Q.value = 0.707;

    // Alien Voice: ring modulation via LFO driving gain
    this.ringGain = this.context.createGain();
    this.ringGain.gain.value = 1; // full pass-through when amount=0
    this.alienOsc = this.context.createOscillator();
    this.alienOsc.type = 'sine';
    this.alienOsc.frequency.value = 20; // base low frequency
    this.alienModGain = this.context.createGain();
    this.alienModGain.gain.value = 0; // disabled by default
    // Wire modulation to ringGain.gain
    this.alienOsc.connect(this.alienModGain);
    this.alienModGain.connect(this.ringGain.gain);
    try { this.alienOsc.start(); } catch {}

    // Gurgle: band-pass with LFO sweeping center frequency
    this.gurgleBP = this.context.createBiquadFilter();
    // Neutral by default: allpass so zero amount does not color audio
    this.gurgleBP.type = 'allpass';
    this.gurgleBP.frequency.value = 500;
    this.gurgleBP.Q.value = 1.0;
    this.gurgleLFO = this.context.createOscillator();
    this.gurgleLFO.type = 'sine';
    this.gurgleLFO.frequency.value = 0.2;
    this.gurgleLFOGain = this.context.createGain();
    this.gurgleLFOGain.gain.value = 0; // disabled by default
    // Wire modulation to gurgleBP.frequency
    this.gurgleLFO.connect(this.gurgleLFOGain);
    this.gurgleLFOGain.connect(this.gurgleBP.frequency);
    try { this.gurgleLFO.start(); } catch {}

    // Destination routing
    this.masterGain.connect(this.context.destination);
    this.panner.connect(this.masterGain);
    this.panner.connect(this.analyser);

    // Setup worklet
    this.initWorklet();
  }

  async initWorklet() {
    try {
      // Load bitcrusher worklet from inline source (no public asset required)
      await addBitcrusherModule(this.context);
      this.bitcrusherNode = new AudioWorkletNode(this.context, 'bitcrusher-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.workletReady = true;
      // If a source is already playing, ensure the bitcrusher is inserted into the chain
      if (this.source && !this.bypass) {
        try { this.source.disconnect(); } catch {}
        this.source.connect(this.bitcrusherNode as AudioNode);
        (this.bitcrusherNode as AudioNode).connect(this.bitrateLowpass);
      }
      // Reapply last-known parameters so UI settings take effect immediately
      const now = this.context.currentTime;
      this.bitcrusherNode.parameters.get('bitDepth')!.setValueAtTime(this.lastBitDepth, now);
      this.bitcrusherNode.parameters.get('dither')!.setValueAtTime(this.lastDither ? 1 : 0, now);
      this.bitcrusherNode.parameters.get('downsample')!.setValueAtTime(this.lastDownsample, now);
    } catch (err) {
      console.warn('AudioWorklet unavailable, using ScriptProcessor fallback', err);
      this.bitcrusherNode = this.createScriptBitcrusher();
      this.workletReady = false;
      // If a source is already playing, ensure the bitcrusher fallback is inserted into the chain
      if (this.source && !this.bypass) {
        try { this.source.disconnect(); } catch {}
        this.source.connect(this.bitcrusherNode as AudioNode);
        (this.bitcrusherNode as AudioNode).connect(this.bitrateLowpass);
      }
      // Reapply last-known parameters on fallback node
      (this.bitcrusherNode as any).setBitDepth?.(this.lastBitDepth);
      (this.bitcrusherNode as any).setDither?.(this.lastDither);
      (this.bitcrusherNode as any).setDownsample?.(this.lastDownsample);
    }
    // connect fixed chain: bitrateLowpass -> artifactsShaper -> compressor -> maxFreqLowpass
    this.bitrateLowpass.connect(this.artifactsShaper);
    this.artifactsShaper.connect(this.compressor);
    // main dry chain + creative FX
    this.compressor.connect(this.highpass);
    this.highpass.connect(this.underwaterLP);
    this.underwaterLP.connect(this.ringGain);
    this.ringGain.connect(this.gurgleBP);
    this.gurgleBP.connect(this.maxFreqLowpass);
    this.maxFreqLowpass.connect(this.panner);
    // parallel sends (before panner)
    // Chorus: tap from gurgleBP
    this.gurgleBP.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusWet);
    this.chorusWet.connect(this.panner);
    // Delay/Echo: tap from gurgleBP with feedback
    this.gurgleBP.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayWet);
    this.delayWet.connect(this.panner);
    // reverb send chain
    this.compressor.connect(this.reverbGain);
    this.reverbGain.connect(this.convolver);
    this.convolver.connect(this.masterGain);
  }

  // Fallback bitcrusher using ScriptProcessor for environments without AudioWorklet
  private createScriptBitcrusher(): ScriptProcessorNode {
    const node = this.context.createScriptProcessor(1024, 2, 2);
    let currentBits = this.lastBitDepth;
    let currentDither = this.lastDither;
    let currentDownsample = this.lastDownsample;

    // Attach simple setters so the engine can update parameters
    (node as any).setBitDepth = (b: number) => {
      currentBits = Math.max(4, Math.min(24, Math.round(b)));
    };
    (node as any).setDither = (on: boolean) => {
      currentDither = !!on;
    };
    (node as any).setDownsample = (f: number) => {
      currentDownsample = Math.max(1, Math.min(64, Math.round(f)));
    };

    node.onaudioprocess = (e) => {
      const input = e.inputBuffer;
      const output = e.outputBuffer;
      const channels = output.numberOfChannels;
      const step = Math.pow(2, Math.max(4, Math.min(24, Math.round(currentBits)))) - 1;
      const ds = Math.max(1, Math.min(64, Math.round(currentDownsample)));

      // sample & hold buffer per channel
      const lastSamples = new Array(channels).fill(0);
      let counter = 0;

      for (let ch = 0; ch < channels; ch++) {
        const inData = input.getChannelData(ch) || new Float32Array(output.length);
        const outData = output.getChannelData(ch);
        counter = 0;
        for (let i = 0; i < outData.length; i++) {
          if (counter === 0) {
            lastSamples[ch] = inData[i];
          }
          let x = lastSamples[ch];
          counter = (counter + 1) % ds;
          if (currentDither) {
            x += (Math.random() + Math.random() - 1) * (1 / step);
          }
          if (x > 1) x = 1; else if (x < -1) x = -1;
          outData[i] = Math.round(x * step) / step;
        }
      }
    };

    return node;
  }

  getState(): EngineState | null {
    if (!this.buffer) return null;
    return {
      duration: this.buffer.duration,
      sampleRate: this.buffer.sampleRate,
      channels: this.buffer.numberOfChannels,
      nyquist: this.buffer.sampleRate / 2,
    };
  }

  async loadFile(file: File): Promise<EngineState> {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    this.buffer = audioBuffer;
    this.rebuildSource(0);
    return {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      nyquist: audioBuffer.sampleRate / 2,
    };
  }

  rebuildSource(offset: number) {
    console.log('[AudioEngine] rebuildSource start', { offset, hasBuffer: !!this.buffer, hadSource: !!this.source });
    // fade out
    const now = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(0, now, 0.01);

    // stop previous
    if (this.source) {
      // We are intentionally stopping the current source to rebuild; don't trigger onEnded auto-advance
      this.suppressOnEnded = true;
      console.log('[AudioEngine] stopping previous source, suppressOnEnded=true');
      try { this.source.stop(); } catch {}
      try { this.source.disconnect(); } catch {}
      this.source = null;
    }
    if (!this.buffer) return;

    // create new source for seamless seek
    const src = this.context.createBufferSource();
    src.buffer = this.buffer;
    src.onended = () => {
      // Ignore end events from previously stopped sources during rapid seeks/scrubs
      if (this.source !== src) {
        console.log('[AudioEngine] source.onended (non-current source ignored)');
        return;
      }
      // Capture and reset suppression flag so next natural end will be handled
      const suppressed = this.suppressOnEnded;
      this.suppressOnEnded = false;
      // During seeks or internal rebuilds we intentionally stop the old source.
      // Do NOT flip the playing flag in that case, as a new source is already active.
      if (!suppressed) {
        this.playing = false;
        console.log('[AudioEngine] source.onended (natural end)');
        try { this.onEnded?.(); } catch {}
      } else {
        console.log('[AudioEngine] source.onended (suppressed)');
      }
    };
    // apply current playback rate
    try { src.playbackRate.value = this.playbackRate; } catch {}
    this.source = src;

    // connect depending on bypass
    if (this.bypass) {
      // In bypass, route source directly to panner so the analyzer remains active
      src.connect(this.panner);
    } else {
      if (this.bitcrusherNode) {
        src.connect(this.bitcrusherNode as AudioNode);
        (this.bitcrusherNode as AudioNode).connect(this.bitrateLowpass);
      } else {
        // if somehow not ready, connect directly
        src.connect(this.bitrateLowpass);
      }
    }

    // start — clamp slightly below duration to avoid instant onended
    const startAt = Math.max(0, Math.min(offset, Math.max(0, this.buffer.duration - this.epsilon)));
    try {
      src.start(0, startAt);
    } catch (e) {
      console.error('Failed to start source', e);
    }
    // fade in
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime + 0.02, 0.02);
    this.playing = true;
    this.startContextTime = this.context.currentTime;
    this.startOffset = startAt;
  }

  play() {
    if (!this.buffer) return;
    if (this.playing) return;
    // resume from current offset
    const t = Math.min(this.getCurrentTime(), Math.max(0, this.buffer.duration - this.epsilon));
    this.rebuildSource(t);
  }

  pause() {
    // Stop regardless of internal playing flag; source presence determines actual output
    if (!this.source) return;
    const t = this.getCurrentTime();
    // Pausing is a user action; suppress onEnded handler to avoid auto-advance
    this.suppressOnEnded = true;
    console.log('[AudioEngine] pause', { t });
    // Proactively fade out and disconnect to guarantee silence even if stop fails
    try {
      const now = this.context.currentTime;
      this.masterGain.gain.setTargetAtTime(0, now, 0.01);
    } catch {}
    try { this.source.stop(); } catch {}
    try { this.source.disconnect(); } catch {}
    this.source = null;
    this.playing = false;
    this.startOffset = t;
  }

  seek(seconds: number) {
    if (!this.buffer) return;
    const clamped = Math.max(0, Math.min(seconds, Math.max(0, this.buffer.duration - this.epsilon)));
    // If paused, update startOffset without starting playback to avoid unintended resume
    if (!this.playing) {
      this.suppressOnEnded = true; // guard against any residual onended firing from old source
      this.startOffset = clamped;
      // ensure any existing source is stopped/disconnected so timeline reflects paused seek
      if (this.source) {
        try { this.source.stop(); } catch {}
        try { this.source.disconnect(); } catch {}
        this.source = null;
      }
      console.log('[AudioEngine] seek (paused)', { seconds, clamped });
      return;
    }
    console.log('[AudioEngine] seek', { seconds, clamped });
    this.rebuildSource(clamped);
  }

  getCurrentTime(): number {
    if (!this.playing) return Math.max(0, Math.min(this.startOffset || 0, this.buffer?.duration || Infinity));
    // reflect playbackRate so timeline matches audible speed and clamp to duration
    const t = this.startOffset + (this.context.currentTime - this.startContextTime) * this.playbackRate;
    const dur = this.buffer?.duration ?? Infinity;
    const ct = Math.max(0, Math.min(t, dur));
    return ct;
  }

  setBypass(on: boolean) {
    this.bypass = on;
    if (!this.source) return;
    try { this.source.disconnect(); } catch {}
    if (on) {
      // In bypass, route source directly to panner so the analyzer monitors output
      this.source.connect(this.panner);
    } else {
      if (this.bitcrusherNode) {
        this.source.connect(this.bitcrusherNode as AudioNode);
        (this.bitcrusherNode as AudioNode).connect(this.bitrateLowpass);
      } else {
        this.source.connect(this.bitrateLowpass);
      }
    }
    console.log('[AudioEngine] setBypass', { on });
  }

  updateBitDepth(bits: number, dither: boolean) {
    this.lastBitDepth = Math.max(4, Math.min(24, Math.round(bits)));
    this.lastDither = !!dither;
    if (this.workletReady && this.bitcrusherNode instanceof AudioWorkletNode) {
      const now = this.context.currentTime;
      this.bitcrusherNode.parameters.get('bitDepth')!.setValueAtTime(this.lastBitDepth, now);
      this.bitcrusherNode.parameters.get('dither')!.setValueAtTime(this.lastDither ? 1 : 0, now);
    } else if (this.bitcrusherNode) {
      (this.bitcrusherNode as any).setBitDepth?.(this.lastBitDepth);
      (this.bitcrusherNode as any).setDither?.(this.lastDither);
    }
  }

  updateMaxFrequency(freqHz: number) {
    const nyq = (this.buffer?.sampleRate || this.context.sampleRate) / 2;
    const clamped = Math.max(1, Math.min(freqHz, nyq));
    const now = this.context.currentTime;
    this.maxFreqLowpass.frequency.setTargetAtTime(clamped, now, 0.02);
    // Neutral when at or near Nyquist
    const nearNyq = Math.abs(clamped - nyq) < 10; // small margin
    this.maxFreqLowpass.type = nearNyq ? 'allpass' : 'lowpass';
  }

  updateBitrateFeel(kbps: number) {
    // Continuous kbps→cutoff mapping via piecewise linear anchors
    const nyq = (this.buffer?.sampleRate || this.context.sampleRate) / 2;
    const anchors: Array<[number, number]> = [
      [1, 3000],
      [24, 8000],
      [64, 12000],
      [128, 16000],
      [160, 18000],
      [192, Math.min(20000, nyq)],
      [256, Math.min(22050, nyq)],
      [320, nyq],
    ];
    const k = Math.max(1, Math.min(320, Math.round(kbps)));
    let cutoff = anchors[0][1];
    for (let i = 0; i < anchors.length - 1; i++) {
      const [k1, f1] = anchors[i];
      const [k2, f2] = anchors[i + 1];
      if (k >= k1 && k <= k2) {
        const t = (k - k1) / (k2 - k1);
        cutoff = f1 + t * (f2 - f1);
        break;
      }
    }
    const now = this.context.currentTime;
    this.bitrateLowpass.frequency.setTargetAtTime(cutoff, now, 0.02);
    // Switch to allpass when at or above near-Nyquist for transparency
    const nearNyq = Math.abs(cutoff - nyq) < 10 || k >= 256;
    this.bitrateLowpass.type = nearNyq ? 'allpass' : 'lowpass';

    // Increase artifact shaping and compression at lower kbps; neutral for high kbps
    if (k >= 256) {
      this.artifactsShaper.curve = this.makeSoftClipCurve(0.0);
      this.compressor.threshold.setTargetAtTime(0, now, 0.02);
      this.compressor.ratio.setTargetAtTime(1, now, 0.02);
      this.compressor.knee.setTargetAtTime(0, now, 0.02);
    } else {
      const artifactAmount = k <= 64 ? 0.6 : k <= 96 ? 0.4 : k <= 128 ? 0.25 : 0.1;
      this.artifactsShaper.curve = this.makeSoftClipCurve(artifactAmount);
      this.compressor.threshold.setTargetAtTime(-24 - (64 / k) * 6, now, 0.02);
      this.compressor.ratio.setTargetAtTime(2 + (128 / k), now, 0.02);
      this.compressor.knee.setTargetAtTime(30, now, 0.02);
    }
  }

  updatePlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.25, Math.min(4.0, rate));
    if (this.source) {
      try { this.source.playbackRate.setTargetAtTime(this.playbackRate, this.context.currentTime, 0.02); } catch {}
    }
  }

  updateVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    const target = this.muted ? 0 : this.volume;
    this.masterGain.gain.setTargetAtTime(target, this.context.currentTime, 0.02);
  }

  setMuted(on: boolean) {
    this.muted = !!on;
    const target = this.muted ? 0 : this.volume;
    this.masterGain.gain.setTargetAtTime(target, this.context.currentTime, 0.02);
  }

  updatePan(pan: number) {
    this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), this.context.currentTime, 0.02);
  }

  updateHighpass(cutHz: number) {
    const cut = Math.max(0, Math.min(cutHz, 2000));
    const now = this.context.currentTime;
    this.highpass.frequency.setTargetAtTime(cut, now, 0.02);
    // Neutral when cut is zero
    this.highpass.type = cut === 0 ? 'allpass' : 'highpass';
  }

  updateReverbWet(wet: number) {
    // Slightly slower smoothing to avoid clicks and improve perceived transitions
    this.reverbGain.gain.setTargetAtTime(Math.max(0, Math.min(1, wet)), this.context.currentTime, 0.05);
  }

  // Tremolo controls
  updateTremoloDepth(amount: number) {
    const a = Math.max(0, Math.min(1, amount));
    this.tremoloGain.gain.setTargetAtTime(a, this.context.currentTime, 0.03);
  }

  updateTremoloRate(hz: number) {
    const r = Math.max(0.5, Math.min(10, hz));
    try { this.tremoloLFO.frequency.setTargetAtTime(r, this.context.currentTime, 0.03); } catch { this.tremoloLFO.frequency.value = r; }
  }

  updateDownsampleFactor(factor: number) {
    const f = Math.max(1, Math.min(64, Math.round(factor)));
    this.lastDownsample = f;
    if (this.workletReady && this.bitcrusherNode instanceof AudioWorkletNode) {
      this.bitcrusherNode.parameters.get('downsample')!.setValueAtTime(f, this.context.currentTime);
    } else if (this.bitcrusherNode) {
      (this.bitcrusherNode as any).setDownsample?.(f);
    }
  }

  // Creative FX controls
  updateAlienVoice(amount: number) {
    const now = this.context.currentTime;
    const a = Math.max(0, Math.min(1, amount));
    // Depth drives ringGain gain inverse and mod depth
    this.alienModGain.gain.setTargetAtTime(a, now, 0.02);
    this.ringGain.gain.setTargetAtTime(1 - a, now, 0.02);
    // Sweep mod frequency for different robotic textures
    const freq = 20 + a * 100; // 20..120 Hz
    try { this.alienOsc.frequency.setTargetAtTime(freq, now, 0.02); } catch { this.alienOsc.frequency.value = freq; }
  }

  // Chorus controls
  updateChorusMix(mix: number) {
    const m = Math.max(0, Math.min(1, mix));
    this.chorusWet.gain.setTargetAtTime(m, this.context.currentTime, 0.03);
  }

  updateChorusDepth(ms: number) {
    const sec = Math.max(0, Math.min(10, ms)) / 1000; // clamp 0..10 ms
    this.chorusLFOGain.gain.setTargetAtTime(sec, this.context.currentTime, 0.03);
  }

  updateChorusRate(hz: number) {
    const r = Math.max(0.2, Math.min(5, hz));
    try { this.chorusLFO.frequency.setTargetAtTime(r, this.context.currentTime, 0.03); } catch { this.chorusLFO.frequency.value = r; }
  }

  // Delay/Echo controls
  updateDelayTime(ms: number) {
    const sec = Math.max(0.01, Math.min(1.0, ms / 1000));
    try { this.delayNode.delayTime.setTargetAtTime(sec, this.context.currentTime, 0.03); } catch { this.delayNode.delayTime.value = sec; }
  }

  updateDelayFeedback(amount: number) {
    const a = Math.max(0, Math.min(0.8, amount));
    this.delayFeedback.gain.setTargetAtTime(a, this.context.currentTime, 0.03);
  }

  updateDelayMix(mix: number) {
    const m = Math.max(0, Math.min(1, mix));
    this.delayWet.gain.setTargetAtTime(m, this.context.currentTime, 0.03);
  }

  // Reverb shape update
  updateReverbParams({ sizeSec, decay }: { sizeSec: number; decay: number }) {
    const dur = Math.max(0.2, Math.min(4.0, sizeSec));
    const d = Math.max(0.3, Math.min(0.95, decay));
    this.convolver.buffer = this.makeNoiseIR(dur, d);
  }

  // Filter Q controls
  updateLowpassQ(q: number) {
    const v = Math.max(0.5, Math.min(2.5, q));
    this.maxFreqLowpass.Q.setTargetAtTime(v, this.context.currentTime, 0.02);
  }

  updateHighpassQ(q: number) {
    const v = Math.max(0.5, Math.min(2.0, q));
    this.highpass.Q.setTargetAtTime(v, this.context.currentTime, 0.02);
  }

  updateUnderwater(amount: number) {
    const now = this.context.currentTime;
    const a = Math.max(0, Math.min(1, amount));
    // Neutral when amount is 0: allpass
    this.underwaterLP.type = a === 0 ? 'allpass' : 'lowpass';
    const nyq = (this.buffer?.sampleRate || this.context.sampleRate) / 2;
    const cutoff = a === 0 ? nyq : 8000 - (8000 - 300) * (a * a); // ease-in
    const q = a === 0 ? 0.707 : 0.7 + 0.5 * a;
    this.underwaterLP.frequency.setTargetAtTime(cutoff, now, 0.05);
    this.underwaterLP.Q.setTargetAtTime(q, now, 0.05);
  }

  updateGurgle(amount: number) {
    const now = this.context.currentTime;
    const a = Math.max(0, Math.min(1, amount));
    // Switch filter type: allpass for zero, bandpass for >0
    this.gurgleBP.type = a === 0 ? 'allpass' : 'bandpass';
    // Base center and Q
    this.gurgleBP.frequency.setTargetAtTime(500, now, 0.02);
    const qNeutral = 0.0001; // minimize phase shift in allpass
    this.gurgleBP.Q.setTargetAtTime(a === 0 ? qNeutral : 1.0 + 4.0 * a, now, 0.05);
    // LFO rate and modulation depth
    const rate = 0.2 + 2.8 * a; // 0.2..3.0 Hz
    const depth = 1200 * a; // Hz swing
    try { this.gurgleLFO.frequency.setTargetAtTime(rate, now, 0.05); } catch { this.gurgleLFO.frequency.value = rate; }
    this.gurgleLFOGain.gain.setTargetAtTime(depth, now, 0.05);
  }

  // Offline render the current mix to an AudioBuffer, approximating the real-time chain.
  async renderCurrentMix(): Promise<AudioBuffer> {
    if (!this.buffer) throw new Error('No audio loaded');
    const srcBuffer = this.buffer;
    const channels = srcBuffer.numberOfChannels;
    const sampleRate = srcBuffer.sampleRate;
    const length = srcBuffer.length;

    // Pre-apply bit depth quantization and downsample to emulate worklet placement
    const preBuffer = new AudioBuffer({ length, sampleRate, numberOfChannels: channels });
    const step = Math.pow(2, this.lastBitDepth) - 1;
    let counter = 0;
    const factor = Math.max(1, Math.min(64, Math.round(this.lastDownsample)));
    const lastSamples = new Array(channels).fill(0);
    for (let ch = 0; ch < channels; ch++) {
      const inData = srcBuffer.getChannelData(ch);
      const outData = preBuffer.getChannelData(ch);
      counter = 0;
      for (let i = 0; i < length; i++) {
        // sample & hold
        if (counter === 0) {
          lastSamples[ch] = inData[i];
        }
        let x = lastSamples[ch];
        counter = (counter + 1) % factor;
        if (this.lastDither) {
          x += (Math.random() + Math.random() - 1) * (1 / step);
        }
        if (x > 1) x = 1; else if (x < -1) x = -1;
        outData[i] = Math.round(x * step) / step;
      }
    }

    // Build offline graph for the rest of processing
    const offCtx = new OfflineAudioContext(channels, length, sampleRate);
    const src = offCtx.createBufferSource();
    src.buffer = preBuffer;
    // recreate nodes with current settings
    const bitrateLP = offCtx.createBiquadFilter();
    bitrateLP.type = this.bitrateLowpass.type as BiquadFilterType;
    bitrateLP.frequency.value = this.bitrateLowpass.frequency.value;
    bitrateLP.Q.value = this.bitrateLowpass.Q.value;

    const shaper = offCtx.createWaveShaper();
    shaper.curve = this.artifactsShaper.curve;

    const comp = offCtx.createDynamicsCompressor();
    comp.threshold.value = this.compressor.threshold.value;
    comp.knee.value = this.compressor.knee.value;
    comp.ratio.value = this.compressor.ratio.value;
    comp.attack.value = this.compressor.attack.value;
    comp.release.value = this.compressor.release.value;

    const hp = offCtx.createBiquadFilter();
    hp.type = this.highpass.type as BiquadFilterType;
    hp.frequency.value = this.highpass.frequency.value;
    hp.Q.value = this.highpass.Q.value;

    const underLP = offCtx.createBiquadFilter();
    underLP.type = this.underwaterLP.type as BiquadFilterType;
    underLP.frequency.value = this.underwaterLP.frequency.value;
    underLP.Q.value = this.underwaterLP.Q.value;

    const ring = offCtx.createGain();
    ring.gain.value = this.ringGain.gain.value;
    const alienOffOsc = offCtx.createOscillator();
    alienOffOsc.type = 'sine';
    alienOffOsc.frequency.value = this.alienOsc.frequency.value;
    const alienOffGain = offCtx.createGain();
    alienOffGain.gain.value = this.alienModGain.gain.value;
    alienOffOsc.connect(alienOffGain);
    alienOffGain.connect(ring.gain);

    const gurgle = offCtx.createBiquadFilter();
    gurgle.type = this.gurgleBP.type as BiquadFilterType;
    gurgle.frequency.value = this.gurgleBP.frequency.value;
    gurgle.Q.value = this.gurgleBP.Q.value;
    const gurgleOffOsc = offCtx.createOscillator();
    gurgleOffOsc.type = 'sine';
    gurgleOffOsc.frequency.value = this.gurgleLFO.frequency.value;
    const gurgleOffGain = offCtx.createGain();
    gurgleOffGain.gain.value = this.gurgleLFOGain.gain.value;
    gurgleOffOsc.connect(gurgleOffGain);
    gurgleOffGain.connect(gurgle.frequency);

    const maxLP = offCtx.createBiquadFilter();
    maxLP.type = this.maxFreqLowpass.type as BiquadFilterType;
    maxLP.frequency.value = this.maxFreqLowpass.frequency.value;
    maxLP.Q.value = this.maxFreqLowpass.Q.value;

    const pan = offCtx.createStereoPanner();
    pan.pan.value = this.panner.pan.value;

    const wetGain = offCtx.createGain();
    wetGain.gain.value = this.reverbGain.gain.value;
    const conv = offCtx.createConvolver();
    conv.normalize = true;
    conv.buffer = this.convolver.buffer;

    // connections: dry
    src.connect(bitrateLP);
    bitrateLP.connect(shaper);
    shaper.connect(comp);
    comp.connect(hp);
    hp.connect(underLP);
    underLP.connect(ring);
    ring.connect(gurgle);
    gurgle.connect(maxLP);
    maxLP.connect(pan);
    pan.connect(offCtx.destination);
    // wet send
    comp.connect(wetGain);
    wetGain.connect(conv);
    conv.connect(offCtx.destination);

    alienOffOsc.start();
    gurgleOffOsc.start();
    src.start();
    return offCtx.startRendering();
  }

  // Utility: soft clip curve for artifacts shaping
  private makeSoftClipCurve(amount: number) {
    const n = 1024;
    const curve = new Float32Array(n);
    const k = Math.max(0, Math.min(1, amount)) * 5; // shape factor
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  // Utility: simple noise impulse response for reverb
  private makeNoiseIR(durationSec: number, decay: number) {
    const sr = this.context.sampleRate;
    const length = Math.floor(sr * durationSec);
    const buffer = this.context.createBuffer(2, length, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }
}