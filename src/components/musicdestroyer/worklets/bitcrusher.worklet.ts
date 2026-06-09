// Utility to load the Bitcrusher AudioWorklet from a blob URL, so the source
// lives in the components folder rather than public assets.
// The code below is executed in the AudioWorklet global scope when loaded.

export async function addBitcrusherModule(context: AudioContext): Promise<void> {
  const source = BITCRUSHER_WORKLET_SOURCE;
  const blob = new Blob([source], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    // Once the module is loaded, the worklet keeps its code; revoke the URL.
    URL.revokeObjectURL(url);
  }
}

// Inline source of the worklet. Kept 1:1 with the previous public version.
const BITCRUSHER_WORKLET_SOURCE = `
class BitcrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'bitDepth',
        defaultValue: 16,
        minValue: 4,
        maxValue: 24,
        automationRate: 'k-rate',
      },
      {
        name: 'dither',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'downsample',
        defaultValue: 1,
        minValue: 1,
        maxValue: 64,
        automationRate: 'k-rate',
      },
    ];
  }

  constructor() {
    super();
    // Per-channel state to keep sample & hold consistent across channels
    this.lastSamples = [];
    this.counters = [];
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const input = inputs[0] || output; // passthrough if no input
    const bitDepth = parameters.bitDepth.length > 0 ? parameters.bitDepth[0] : 16;
    const dither = parameters.dither.length > 0 ? parameters.dither[0] : 0;
    const downsample = parameters.downsample.length > 0 ? parameters.downsample[0] : 1;
    const step = Math.pow(2, Math.max(4, Math.min(24, Math.round(bitDepth)))) - 1;
    const ds = Math.max(1, Math.min(64, Math.round(downsample)));

    // Ensure per-channel arrays are sized correctly
    if (this.lastSamples.length !== output.length) {
      this.lastSamples = new Array(output.length).fill(0);
    }
    if (this.counters.length !== output.length) {
      this.counters = new Array(output.length).fill(0);
    }

    for (let ch = 0; ch < output.length; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch];
      let counter = this.counters[ch] | 0;
      for (let i = 0; i < outputChannel.length; i++) {
        if (counter === 0) {
          this.lastSamples[ch] = inputChannel ? inputChannel[i] : 0;
        }
        let x = this.lastSamples[ch];
        counter = (counter + 1) % ds;
        if (dither > 0.5) {
          x += (Math.random() + Math.random() - 1) * (1 / step);
        }
        if (x > 1) x = 1; else if (x < -1) x = -1;
        outputChannel[i] = Math.round(x * step) / step;
      }
      this.counters[ch] = counter;
    }
    return true;
  }
}

registerProcessor('bitcrusher-processor', BitcrusherProcessor);
`;