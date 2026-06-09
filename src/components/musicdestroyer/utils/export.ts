// Encode an AudioBuffer into a 16-bit PCM WAV Blob
export function encodeWAVFromAudioBuffer(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  // Interleave channels
  const interleaved = new Int16Array(length * numChannels);
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = buffer.getChannelData(ch)[i];
      const s = Math.max(-1, Math.min(1, sample));
      interleaved[i * numChannels + ch] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
  }

  const headerSize = 44;
  const dataSize = interleaved.length * bytesPerSample;
  const totalSize = headerSize + dataSize;
  const bufferView = new ArrayBuffer(totalSize);
  const dv = new DataView(bufferView);

  // RIFF header
  writeString(dv, 0, 'RIFF');
  dv.setUint32(4, totalSize - 8, true); // file size - 8
  writeString(dv, 8, 'WAVE');

  // fmt chunk
  writeString(dv, 12, 'fmt ');
  dv.setUint32(16, 16, true); // PCM chunk size
  dv.setUint16(20, 1, true); // audio format 1 = PCM
  dv.setUint16(22, numChannels, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, byteRate, true);
  dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(dv, 36, 'data');
  dv.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    dv.setInt16(offset, interleaved[i], true);
    offset += 2;
  }

  return new Blob([dv], { type: 'audio/wav' });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function writeString(dv: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    dv.setUint8(offset + i, str.charCodeAt(i));
  }
}