import confetti from 'canvas-confetti';

const KAPL_COLORS = [
  '#EAB308', // Electric Amber
  '#FACC15', // Gold
  '#10B981', // Cyber Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Royal Blue
  '#EC4899', // Pink
  '#FFFFFF', // Stadium White
];

/**
 * Multi-cannon celebratory confetti burst for match victories and tournament finals.
 */
export function triggerCelebrationConfetti(durationMs: number = 3000) {
  if (typeof window === 'undefined') return;

  const end = Date.now() + durationMs;

  // Center big burst
  confetti({
    particleCount: 80,
    spread: 100,
    origin: { y: 0.6 },
    colors: KAPL_COLORS,
    disableForReducedMotion: true,
  });

  // Continuous side cannons
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: KAPL_COLORS,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: KAPL_COLORS,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  requestAnimationFrame(frame);
}

/**
 * Quick single shot confetti burst (for 4s, 6s, and auction sold hammer)
 */
export function triggerQuickBurst() {
  if (typeof window === 'undefined') return;
  confetti({
    particleCount: 45,
    spread: 60,
    origin: { y: 0.7 },
    colors: KAPL_COLORS,
    disableForReducedMotion: true,
  });
}

