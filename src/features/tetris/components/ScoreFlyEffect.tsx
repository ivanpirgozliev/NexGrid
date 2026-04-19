import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';

export interface ScoreFlight {
  id: number;
  points: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface ScoreFlyEffectProps {
  flights: ScoreFlight[];
  onArrive: (flight: ScoreFlight) => void;
}

export const ScoreFlyEffect = memo(function ScoreFlyEffect({ flights, onArrive }: ScoreFlyEffectProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <AnimatePresence>
        {flights.map((flight) => {
          const deltaX = flight.endX - flight.startX;
          const deltaY = flight.endY - flight.startY;

          return (
            <motion.div
              key={flight.id}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
              animate={{
                x: [0, deltaX * 0.22, deltaX],
                y: [0, -28, deltaY],
                opacity: [0, 1, 0.25],
                scale: [0.6, 1.08, 0.82],
              }}
              transition={{ duration: 0.9, times: [0, 0.24, 1], ease: 'easeInOut' }}
              onAnimationComplete={() => onArrive(flight)}
              style={{ left: flight.startX, top: flight.startY }}
              className="absolute"
            >
              <div className="-translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/70 bg-cyan-400/15 px-3 py-1 text-xs font-black tracking-wide text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.55)] sm:text-sm">
                +{flight.points.toLocaleString()}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});
