import { memo, useEffect, useRef, useState } from 'react';
import { BOARD_HEIGHT } from '../utils/board';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
}

const PARTICLE_COLORS = [
  '#22d3ee',
  '#67e8f9',
  '#a5f3fc',
  '#ffffff',
  '#fbbf24',
  '#34d399',
];

function generateParticles(rowIdx: number, count: number): Particle[] {
  const rowTopPercent = (rowIdx / BOARD_HEIGHT) * 100;
  const rowMidPercent = rowTopPercent + (1 / BOARD_HEIGHT) * 50;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() * 100),
    y: rowMidPercent,
    vx: (Math.random() - 0.5) * 3,
    vy: (Math.random() - 0.5) * 4 - 1,
    size: Math.random() * 4 + 2,
    opacity: 1,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
  }));
}

interface LineClearEffectProps {
  clearedRows: number[];
}

export const LineClearEffect = memo(function LineClearEffect({ clearedRows }: LineClearEffectProps) {
  const [phase, setPhase] = useState<'flash' | 'particles'>('flash');
  const [particles, setParticles] = useState<Particle[]>([]);
  const particlesSpawned = useRef(false);

  useEffect(() => {
    if (clearedRows.length === 0) {
      particlesSpawned.current = false;
      return;
    }

    setPhase('flash');
    particlesSpawned.current = false;

    const flashTimer = setTimeout(() => {
      setPhase('particles');
      const allParticles = clearedRows.flatMap((row, rowGroupIdx) =>
        generateParticles(row, 20).map((p) => ({
          ...p,
          id: rowGroupIdx * 100 + p.id,
        }))
      );
      setParticles(allParticles);
      particlesSpawned.current = true;
    }, 150);

    return () => clearTimeout(flashTimer);
  }, [clearedRows]);

  useEffect(() => {
    if (phase !== 'particles' || !particlesSpawned.current) return;

    let frameId: number;
    const startTime = performance.now();
    const duration = 250;

    function animate() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy + progress * 2,
          opacity: 1 - progress,
        }))
      );

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    }

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [phase]);

  if (clearedRows.length === 0) return null;

  const rowHeight = (1 / BOARD_HEIGHT) * 100;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {phase === 'flash' &&
        clearedRows.map((rowIdx) => (
          <div
            key={`flash-${rowIdx}`}
            className="absolute inset-x-0 animate-line-clear-flash"
            style={{
              top: `${(rowIdx / BOARD_HEIGHT) * 100}%`,
              height: `${rowHeight}%`,
            }}
          >
            <div className="absolute inset-0 bg-white" style={{ animation: 'lineClearFlash 150ms ease-out forwards' }} />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.6), transparent)',
                animation: 'lineClearSweep 150ms ease-out forwards',
              }}
            />
          </div>
        ))}

      {phase === 'particles' &&
        particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              opacity: p.opacity,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

      {clearedRows.map((rowIdx) => (
        <div
          key={`glow-${rowIdx}`}
          className="absolute inset-x-0"
          style={{
            top: `${(rowIdx / BOARD_HEIGHT) * 100 - rowHeight}%`,
            height: `${rowHeight * 3}%`,
            background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.15) 0%, transparent 70%)',
            animation: 'lineClearFade 400ms ease-out forwards',
          }}
        />
      ))}
    </div>
  );
});
