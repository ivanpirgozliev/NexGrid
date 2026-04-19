import { useCallback, useEffect, useRef } from 'react';

type AudioCtor = typeof AudioContext;

type Tone = {
  frequency: number;
  durationMs: number;
  delayMs?: number;
  gain?: number;
  type?: OscillatorType;
};

interface GameAudioOptions {
  masterVolume?: number;
  effectsVolume?: number;
  muted?: boolean;
}

type BrowserWindow = Window & {
  webkitAudioContext?: AudioCtor;
};

function getAudioContextCtor(): AudioCtor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if ('AudioContext' in window) {
    return AudioContext;
  }

  const browserWindow = window as BrowserWindow;
  return browserWindow.webkitAudioContext ?? null;
}

function playTone(ctx: AudioContext, startAt: number, tone: Tone) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = tone.type ?? 'triangle';
  oscillator.frequency.value = tone.frequency;

  const startedAt = startAt + (tone.delayMs ?? 0) / 1000;
  const endedAt = startedAt + tone.durationMs / 1000;
  const maxGain = tone.gain ?? 0.07;

  // A short attack/release envelope avoids clicks and keeps sounds crisp.
  gainNode.gain.setValueAtTime(0, startedAt);
  gainNode.gain.linearRampToValueAtTime(maxGain, startedAt + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endedAt);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startedAt);
  oscillator.stop(endedAt + 0.01);
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function useGameAudio(options?: GameAudioOptions) {
  const contextRef = useRef<AudioContext | null>(null);

  const masterVolume = clampVolume(options?.masterVolume ?? 1);
  const effectsVolume = clampVolume(options?.effectsVolume ?? 1);
  const muted = options?.muted ?? false;

  const ensureContext = useCallback((): AudioContext | null => {
    const Ctor = getAudioContextCtor();
    if (!Ctor) {
      return null;
    }

    if (!contextRef.current) {
      contextRef.current = new Ctor();
    }

    if (contextRef.current.state === 'suspended') {
      void contextRef.current.resume();
    }

    return contextRef.current;
  }, []);

  const playPattern = useCallback(
    (tones: Tone[]) => {
      const ctx = ensureContext();
      if (!ctx) {
        return;
      }

      const volumeScale = muted ? 0 : masterVolume * effectsVolume;
      if (volumeScale <= 0.001) {
        return;
      }

      const startAt = ctx.currentTime + 0.01;
      tones.forEach((tone) => playTone(ctx, startAt, {
        ...tone,
        gain: (tone.gain ?? 0.07) * volumeScale,
      }));
    },
    [ensureContext, effectsVolume, masterVolume, muted]
  );

  const playLineClear = useCallback(
    (linesCleared: number) => {
      const clamped = Math.max(1, Math.min(4, linesCleared));
      if (clamped === 1) {
        playPattern([
          { frequency: 523.25, durationMs: 90, gain: 0.06, type: 'triangle' },
          { frequency: 659.25, durationMs: 80, delayMs: 65, gain: 0.045, type: 'sine' },
        ]);
        return;
      }

      if (clamped === 2) {
        playPattern([
          { frequency: 493.88, durationMs: 85, gain: 0.06, type: 'triangle' },
          { frequency: 659.25, durationMs: 85, delayMs: 55, gain: 0.055, type: 'triangle' },
          { frequency: 783.99, durationMs: 95, delayMs: 115, gain: 0.05, type: 'sine' },
        ]);
        return;
      }

      if (clamped === 3) {
        playPattern([
          { frequency: 523.25, durationMs: 75, gain: 0.06, type: 'triangle' },
          { frequency: 659.25, durationMs: 75, delayMs: 50, gain: 0.055, type: 'triangle' },
          { frequency: 783.99, durationMs: 75, delayMs: 100, gain: 0.05, type: 'triangle' },
          { frequency: 987.77, durationMs: 95, delayMs: 155, gain: 0.05, type: 'sine' },
        ]);
        return;
      }

      playPattern([
        { frequency: 659.25, durationMs: 80, gain: 0.065, type: 'square' },
        { frequency: 880, durationMs: 80, delayMs: 45, gain: 0.06, type: 'square' },
        { frequency: 1174.66, durationMs: 130, delayMs: 95, gain: 0.055, type: 'triangle' },
        { frequency: 1567.98, durationMs: 150, delayMs: 150, gain: 0.045, type: 'sine' },
      ]);
    },
    [playPattern]
  );

  const playScoreCollect = useCallback(
    (points: number) => {
      const intensity = Math.min(1.35, 1 + Math.log10(Math.max(points, 10)) / 8);
      playPattern([
        { frequency: 740 * intensity, durationMs: 70, gain: 0.045, type: 'sine' },
        { frequency: 932 * intensity, durationMs: 95, delayMs: 45, gain: 0.04, type: 'triangle' },
      ]);
    },
    [playPattern]
  );

  const playLevelUp = useCallback(
    (level: number) => {
      const pitchBoost = Math.min(1.3, 1 + level / 30);
      playPattern([
        { frequency: 523.25 * pitchBoost, durationMs: 95, gain: 0.055, type: 'triangle' },
        { frequency: 659.25 * pitchBoost, durationMs: 95, delayMs: 70, gain: 0.05, type: 'triangle' },
        { frequency: 783.99 * pitchBoost, durationMs: 130, delayMs: 140, gain: 0.05, type: 'sine' },
      ]);
    },
    [playPattern]
  );

  useEffect(() => {
    return () => {
      if (contextRef.current && contextRef.current.state !== 'closed') {
        void contextRef.current.close();
      }
    };
  }, []);

  return {
    playLineClear,
    playScoreCollect,
    playLevelUp,
  };
}
