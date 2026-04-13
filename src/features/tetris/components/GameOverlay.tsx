import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RotateCcw, Play, Pause } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { GameStatus } from '../types';

interface GameOverlayProps {
  status: GameStatus;
  score: number;
  onStart: () => void;
  onResume: () => void;
}

export function GameOverlay({ status, score, onStart, onResume }: GameOverlayProps) {
  const visible = status === 'idle' || status === 'over' || status === 'paused';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm rounded-lg z-10"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="text-center px-8"
          >
            {status === 'idle' && (
              <>
                <h2 className="text-3xl font-black text-white mb-2 tracking-tight">TETRIS</h2>
                <p className="text-gray-400 text-sm mb-6">Use arrow keys to play</p>
                <Button onClick={onStart} size="lg">
                  <Play className="w-4 h-4" />
                  Start Game
                </Button>
              </>
            )}

            {status === 'over' && (
              <>
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-6 h-6 text-red-400" />
                </div>
                <h2 className="text-2xl font-black text-white mb-1 tracking-tight">GAME OVER</h2>
                <p className="text-gray-500 text-sm mb-1">Final Score</p>
                <p className="text-4xl font-black text-cyan-400 mb-6 tabular-nums">
                  {score.toLocaleString()}
                </p>
                <Button onClick={onStart} variant="primary" size="lg">
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </Button>
              </>
            )}

            {status === 'paused' && (
              <>
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                  <Pause className="w-6 h-6 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-black text-white mb-6 tracking-tight">PAUSED</h2>
                <Button onClick={onResume} size="lg">
                  <Play className="w-4 h-4" />
                  Resume
                </Button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
