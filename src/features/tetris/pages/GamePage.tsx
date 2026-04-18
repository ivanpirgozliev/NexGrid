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
  const { saveScore, resetSaved, startSession } = useSaveScore(state.status === 'playing');

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
      className="lg:min-h-[calc(100vh-64px)]"
    >
      <div className="lg:hidden flex flex-col h-[calc(100dvh-48px)] sm:h-[calc(100dvh-64px)] px-2 py-1.5 gap-1 overflow-hidden">
        <div className="shrink-0 flex gap-1 items-stretch">
          <div className="flex-1 flex gap-1 min-w-0">
            <GameStats score={state.score} level={state.level} lines={state.lines} orientation="horizontal" />
          </div>
          <div className="shrink-0">
            <NextPiece type={state.next} compact />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex justify-center">
          <div className="relative h-full" style={{ aspectRatio: '10 / 20' }}>
            <Board
              board={state.board}
              current={state.current}
              clearedRows={state.clearedRows}
            />
            <GameOverlay
              status={state.status}
              score={state.score}
              onStart={handleStart}
              onResume={resume}
            />
          </div>
        </div>

        <div className="shrink-0 flex justify-center h-8">
          {state.status === 'playing' && (
            <Button variant="secondary" size="sm" onClick={pause} className="w-full max-w-xs gap-1.5 h-8 text-xs">
              <Pause className="w-3 h-3" />
              Pause
            </Button>
          )}
          {state.status === 'paused' && (
            <Button variant="secondary" size="sm" onClick={resume} className="w-full max-w-xs gap-1.5 h-8 text-xs">
              <Play className="w-3 h-3" />
              Resume
            </Button>
          )}
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex items-start justify-center gap-8 py-8 px-4">
        <div className="flex flex-col gap-3 w-48">
          <GameStats score={state.score} level={state.level} lines={state.lines} />
        </div>

        <div className="relative shrink-0 w-[360px]">
          <Board
            board={state.board}
            current={state.current}
            clearedRows={state.clearedRows}
          />
          <GameOverlay
            status={state.status}
            score={state.score}
            onStart={handleStart}
            onResume={resume}
          />
        </div>

        <div className="flex flex-col gap-3 w-48">
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
        </div>
      </div>
    </motion.div>
  );
}
