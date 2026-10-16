// Web Audio API synthesized cricket and tournament sound effects

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

const STORAGE_KEY = 'kapl-sound-effects-enabled';

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== 'false'; // Default to true
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  // Dispatch a custom event so UI buttons react immediately
  window.dispatchEvent(new CustomEvent('kapl-sound-toggle', { detail: { enabled } }));
}

/**
 * Boundary 4: Crisp crack of willow followed by an ascending celebration chime
 */
export function playBoundaryFour() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Bat crack (bandpass noise + fast pitch drop)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);

  // 2. Dual chime notes (C5 -> E5)
  [523.25, 659.25].forEach((freq, i) => {
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    const start = now + 0.07 + i * 0.09;

    chime.type = 'sine';
    chime.frequency.setValueAtTime(freq, start);

    chimeGain.gain.setValueAtTime(0.3, start);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

    chime.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chime.start(start);
    chime.stop(start + 0.25);
  });
}

/**
 * Maximum 6: Heavy power drive impact + triumphant high-energy stadium chime
 */
export function playSixCelebration() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Deep impact boom
  const boom = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(260, now);
  boom.frequency.exponentialRampToValueAtTime(45, now + 0.2);

  boomGain.gain.setValueAtTime(0.8, now);
  boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

  boom.connect(boomGain);
  boomGain.connect(ctx.destination);
  boom.start(now);
  boom.stop(now + 0.25);

  // 2. High-energy celebratory arpeggio (C5 -> E5 -> G5 -> C6)
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + 0.08 + idx * 0.07;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.4, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.35);
  });
}

/**
 * Wicket sound: Stumps shattering / timber rattle
 */
export function playWicketSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Stumps impact rattling
  [440, 320, 220, 150].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + i * 0.04;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, start + 0.12);

    gain.gain.setValueAtTime(0.5 / (i + 1), start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.15);
  });
}

/**
 * Auction Gavel: Solid wooden gavel strike (THWACK!)
 */
export function playAuctionGavel() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Sharp wooden strike
  const strike = ctx.createOscillator();
  const strikeGain = ctx.createGain();
  strike.type = 'triangle';
  strike.frequency.setValueAtTime(1200, now);
  strike.frequency.exponentialRampToValueAtTime(140, now + 0.05);

  strikeGain.gain.setValueAtTime(0.9, now);
  strikeGain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

  strike.connect(strikeGain);
  strikeGain.connect(ctx.destination);
  strike.start(now);
  strike.stop(now + 0.07);

  // 2. Wooden soundboard resonance
  const resonance = ctx.createOscillator();
  const resGain = ctx.createGain();
  resonance.type = 'sine';
  resonance.frequency.setValueAtTime(320, now + 0.02);
  resonance.frequency.exponentialRampToValueAtTime(80, now + 0.22);

  resGain.gain.setValueAtTime(0.6, now + 0.02);
  resGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

  resonance.connect(resGain);
  resGain.connect(ctx.destination);
  resonance.start(now + 0.02);
  resonance.stop(now + 0.25);
}

/**
 * Victory fanfare for match winner / tournament champion
 */
export function playVictoryFanfare() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const chords = [
    { freqs: [523.25, 659.25, 783.99], time: 0, duration: 0.2 },
    { freqs: [587.33, 739.99, 880.0], time: 0.22, duration: 0.2 },
    { freqs: [659.25, 830.61, 987.77], time: 0.44, duration: 0.2 },
    { freqs: [783.99, 987.77, 1174.66], time: 0.68, duration: 0.6 },
  ];

  chords.forEach(({ freqs, time, duration }) => {
    freqs.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + time;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    });
  });
}

