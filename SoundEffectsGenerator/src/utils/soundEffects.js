/**
 * Generates short placeholder sound effects using Web Audio API.
 * In production you could replace with real SFX files or an API (e.g. ElevenLabs).
 */
const effectPresets = {
  whoosh: { type: 'noise', duration: 0.2, freq: 200 },
  impact: { type: 'tone', freq: 80, duration: 0.15, decay: true },
  ding: { type: 'tone', freq: 880, duration: 0.1 },
  rise: { type: 'sweep', start: 200, end: 800, duration: 0.25 },
  drop: { type: 'sweep', start: 600, end: 100, duration: 0.2 },
  swoosh: { type: 'noise', duration: 0.25, freq: 150 },
  pop: { type: 'tone', freq: 400, duration: 0.05 },
  default: { type: 'tone', freq: 440, duration: 0.1 },
};

function getPreset(name) {
  const key = (name || '').toLowerCase().replace(/\s+/g, '');
  return effectPresets[key] || effectPresets.default;
}

export function createAudioContext() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

export async function generateEffectBlob(ctx, effectName) {
  const preset = getPreset(effectName);
  const sampleRate = ctx.sampleRate;
  const duration = preset.duration || 0.2;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (preset.type === 'tone') {
    const freq = preset.freq || 440;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let amp = Math.sin(2 * Math.PI * freq * t);
      if (preset.decay) amp *= 1 - t / duration;
      data[i] = amp * 0.3;
    }
  } else if (preset.type === 'noise') {
    const freq = preset.freq || 200;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() * 2 - 1) * (1 - t / duration);
      const tone = Math.sin(2 * Math.PI * freq * t) * 0.3;
      data[i] = (noise * 0.2 + tone) * 0.4;
    }
  } else if (preset.type === 'sweep') {
    const start = preset.start || 200;
    const end = preset.end || 600;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const freq = start + (end - start) * progress;
      const phase = 2 * Math.PI * (start * t + (end - start) * (t * t) / (2 * duration));
      data[i] = Math.sin(phase) * 0.3 * (1 - progress * 0.5);
    }
  } else {
    for (let i = 0; i < length; i++) data[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 0.2;
  }

  const offline = new OfflineAudioContext(1, length, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return rendered;
}

export async function bufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  const write = (offset, value, little = true) => view.setUint32(offset, value, little);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  write(4, bufferLength - 8);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  write(16, 16); // chunk size
  write(20, format); // PCM
  write(22, numChannels);
  write(24, sampleRate);
  write(28, sampleRate * blockAlign);
  write(32, blockAlign);
  write(34, bitDepth);
  writeString(36, 'data');
  write(40, dataLength);

  const left = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, left[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export async function generateEffectAsBlobUrl(ctx, effectName) {
  const buffer = await generateEffectBlob(ctx, effectName);
  const blob = await bufferToWavBlob(buffer);
  return URL.createObjectURL(blob);
}

export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
