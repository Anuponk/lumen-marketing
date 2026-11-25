import { writeFile } from 'node:fs/promises';

const rate = 48000;
const tau = Math.PI * 2;
const pitch = note => 440 * 2 ** ((note - 69) / 12);
const smooth = x => Math.min(1, Math.max(0, x));
const fade = x => 0.5 - 0.5 * Math.cos(Math.PI * smooth(x));

export async function writeAmbient(file, duration) {
  const chords = [[45, 52, 55, 60, 64], [41, 48, 52, 55, 60],
    [48, 55, 59, 62, 67], [43, 50, 55, 57, 62]].map(chord => chord.map(pitch));
  const length = Math.round(rate * duration);
  const wav = Buffer.alloc(44 + length * 4);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(length * 4, 40);
  const beat = duration / 4;
  for (let i = 0; i < length; i++) {
    const time = i / rate;
    let left = 0, right = 0;
    for (const [index, chord] of chords.entries()) {
      const age = time - index * beat;
      if (age < 0 || age > beat + 2) continue;
      const envelope = fade(age / 1.8) * fade((beat + 2 - age) / 2);
      for (const [part, frequency] of chord.entries()) {
        const phase = tau * frequency * time + part * 0.87;
        const pad = Math.sin(phase) + 0.13 * Math.sin(phase * 2);
        const spread = Math.sin(phase + Math.sin(tau * 0.23 * time + part) * 0.35);
        left += (pad * 0.026 + spread * 0.014) * envelope;
        right += (pad * 0.026 - spread * 0.012) * envelope;
      }
      const sparkAge = age - 2.1;
      if (sparkAge > 0 && sparkAge < 2.8) {
        const spark = Math.sin(tau * chord.at(-1) * 2 * sparkAge) * fade(sparkAge / 0.12) *
          Math.exp(-2.1 * sparkAge) * 0.046;
        left += spark * 0.7;
        right += spark;
      }
    }
    const volume = fade(time / 1.1) * fade((duration - time) / 2);
    wav.writeInt16LE(Math.round(left * volume * 32767), 44 + i * 4);
    wav.writeInt16LE(Math.round(right * volume * 32767), 46 + i * 4);
  }
  await writeFile(file, wav);
}
