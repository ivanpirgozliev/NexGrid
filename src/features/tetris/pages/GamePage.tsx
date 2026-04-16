import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { useTetris } from '../hooks/useTetris';
import { useSaveScore } from '../hooks/useSaveScore';
import { Board } from '../components/Board';
import { GameStats } from '../components/GameStats';
import { NextPiece } from '../components/NextPiece';
import { GameOverlay } from '../components/GameOverlay';
import { Controls } from '../components/Controls';
import { Button } from '../../../components/ui/Button';

export function GamePage() {
  const { state, start, pause, resume } = useTetris();
  const { saveScore, resetSaved, startSession } = useSaveScore();

  useEffect(() => {
    if (state.status === 'over' && state.score > 0) {
      saveScore(state.score, state.level, state.lines);
    }
  }, [state.status, state.score, state.level, state.lines, saveScore]);

  async function handleStart() {
    resetSaved();
    await startSession();
    start();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-start justify-center gap-4 sm:gap-8 py-8 px-4 min-h-[calc(100vh-64px)]"
    >
      <div className="hidden lg:flex flex-col gap-3 w-48">
        <GameStats score={state.score} level={state.level} lines={state.lines} />
      </div>

      <div className="relative shrink-0" style={{ width: 'min(360px, calc(100vw - 220px))', height: 'min(720px, calc((100vw - 220px) * 2))' }}>
        {state.current !== null || state.status !== 'idle' ? (
          <Board
            board={state.board}
            current={state.current}
            clearedRows={state.clearedRows}
          />
        ) : (
          <Board
            board={state.board}
            current={null}
            clearedRows={[]}
          />
        )}
        <GameOverlay
          status={state.status}
          score={state.score}
          onStart={handleStart}
          onResume={resume}
        />
      </div>

      <div className="flex flex-col gap-3 w-40 sm:w-48">
        <NextPiece type={state.next} />

        {state.status === 'playing' && (
          <Button variant="secondary" size="sm" onClick={pause} className="w-full gap-1.5">
            <Pause className="w-3.5 h-3.5" />
            Pause
          </Button>
        )}
        {state.status === 'paused' && (
          <Button variant="secondary" size="sm" onClick={resume} className="w-full gap-1.5">
            <Play className="w-3.5 h-3.5" />
            Resume
          </Button>
        )}

        <Controls />

        <div className="lg:hidden">
          <GameStats score={state.score} level={state.level} lines={state.lines} />
        </div>
      </div>
    </motion.div>
  );
}
