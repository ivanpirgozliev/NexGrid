import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { useTetris } from '../hooks/useTetris';
import { useSaveScore } from '../hooks/useSaveScore';
import { useGameAudio } from '../hooks/useGameAudio';
import { Board } from '../components/Board';
import { GameStats } from '../components/GameStats';
import { NextPiece } from '../components/NextPiece';
import { GameOverlay } from '../components/GameOverlay';
import { Controls } from '../components/Controls';
import { ScoreFlyEffect, type ScoreFlight } from '../components/ScoreFlyEffect';
import { Button } from '../../../components/ui/Button';

const BOARD_ROWS = 20;

function pickVisibleElement<T extends HTMLElement>(first: T | null, second: T | null): T | null {
  if (first && first.offsetParent !== null) {
    return first;
  }

  if (second && second.offsetParent !== null) {
    return second;
  }

  return first ?? second;
}

export function GamePage() {
  const { state, start, pause, resume } = useTetris();
  const { playLineClear, playScoreCollect, playLevelUp } = useGameAudio();
  const isActive =
    state.status === 'playing' ||
    state.status === 'clearing' ||
    state.status === 'paused';
  const { saveScore, resetSaved, startSession, saveError } = useSaveScore(isActive);

  const [displayScore, setDisplayScore] = useState(state.score);
  const [scoreFlights, setScoreFlights] = useState<ScoreFlight[]>([]);
  const [scorePulseKey, setScorePulseKey] = useState(0);

  const mobileBoardRef = useRef<HTMLDivElement>(null);
  const desktopBoardRef = useRef<HTMLDivElement>(null);
  const mobileScoreCardRef = useRef<HTMLDivElement>(null);
  const desktopScoreCardRef = useRef<HTMLDivElement>(null);

  const clearOriginRef = useRef<{ x: number; y: number } | null>(null);
  const prevScoreRef = useRef(state.score);
  const prevLinesRef = useRef(state.lines);
  const prevLevelRef = useRef(state.level);
  const flightIdRef = useRef(0);

  useEffect(() => {
    if (state.status === 'over' && state.score > 0) {
      saveScore(state.score, state.level, state.lines);
    }
  }, [state.status, state.score, state.level, state.lines, saveScore]);

  useEffect(() => {
    if (state.status !== 'clearing' || state.clearedRows.length === 0) {
      return;
    }

    playLineClear(state.clearedRows.length);

    const boardElement = pickVisibleElement(mobileBoardRef.current, desktopBoardRef.current);
    if (!boardElement) {
      return;
    }

    const boardRect = boardElement.getBoundingClientRect();
    const averageRow = state.clearedRows.reduce((sum, row) => sum + row, 0) / state.clearedRows.length;

    clearOriginRef.current = {
      x: boardRect.left + boardRect.width * 0.5,
      y: boardRect.top + ((averageRow + 0.5) / BOARD_ROWS) * boardRect.height,
    };
  }, [state.status, state.clearedRows, playLineClear]);

  useEffect(() => {
    if (state.level > prevLevelRef.current) {
      playLevelUp(state.level);
    }

    prevLevelRef.current = state.level;
  }, [state.level, playLevelUp]);

  useEffect(() => {
    const previousScore = prevScoreRef.current;
    const previousLines = prevLinesRef.current;

    if (state.score < previousScore) {
      setScoreFlights([]);
      setDisplayScore(state.score);
      prevScoreRef.current = state.score;
      prevLinesRef.current = state.lines;
      return;
    }

    if (state.score > previousScore) {
      const pointsDelta = state.score - previousScore;
      const linesDelta = state.lines - previousLines;
      const scoreCardElement = pickVisibleElement(mobileScoreCardRef.current, desktopScoreCardRef.current);

      if (linesDelta > 0 && scoreCardElement) {
        const scoreRect = scoreCardElement.getBoundingClientRect();
        const boardElement = pickVisibleElement(mobileBoardRef.current, desktopBoardRef.current);
        const boardRect = boardElement?.getBoundingClientRect();

        const fallbackOrigin = {
          x: boardRect ? boardRect.left + boardRect.width * 0.5 : scoreRect.left + scoreRect.width * 0.5,
          y: boardRect ? boardRect.top + boardRect.height * 0.45 : scoreRect.top + scoreRect.height + 24,
        };

        const id = flightIdRef.current;
        flightIdRef.current += 1;

        setScoreFlights((prev) => [
          ...prev,
          {
            id,
            points: pointsDelta,
            startX: clearOriginRef.current?.x ?? fallbackOrigin.x,
            startY: clearOriginRef.current?.y ?? fallbackOrigin.y,
            endX: scoreRect.left + scoreRect.width * 0.5,
            endY: scoreRect.top + scoreRect.height * 0.5,
          },
        ]);
      } else {
        setDisplayScore(state.score);
      }
    }

    prevScoreRef.current = state.score;
    prevLinesRef.current = state.lines;
  }, [state.score, state.lines]);

  useEffect(() => {
    if (scoreFlights.length === 0 && displayScore !== state.score) {
      setDisplayScore(state.score);
    }
  }, [scoreFlights.length, displayScore, state.score]);

  const handleFlightArrive = useCallback(
    (flight: ScoreFlight) => {
      setScoreFlights((prev) => prev.filter((item) => item.id !== flight.id));
      setDisplayScore((prev) => prev + flight.points);
      setScorePulseKey((prev) => prev + 1);
      playScoreCollect(flight.points);
    },
    [playScoreCollect]
  );

  async function handleStart() {
    resetSaved();
    const sessionStarted = await startSession();
    if (!sessionStarted) {
      return;
    }

    clearOriginRef.current = null;
    prevScoreRef.current = 0;
    prevLinesRef.current = 0;
    prevLevelRef.current = 1;
    setDisplayScore(0);
    setScoreFlights([]);
    setScorePulseKey(0);

    start();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className=""
    >
      {saveError && (
        <div className="mx-auto mb-2 max-w-[840px] rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {saveError}
        </div>
      )}

      <div className="lg:hidden flex flex-col h-[calc(100dvh-48px)] sm:h-[calc(100dvh-64px)] px-2 py-1.5 gap-1 overflow-hidden">
        <div className="shrink-0 flex gap-1 items-stretch">
          <div className="flex-1 flex gap-1 min-w-0">
            <GameStats
              score={displayScore}
              level={state.level}
              lines={state.lines}
              orientation="horizontal"
              scoreCardRef={mobileScoreCardRef}
              scorePulseKey={scorePulseKey > 0 ? scorePulseKey : undefined}
            />
          </div>
          <div className="shrink-0">
            <NextPiece type={state.next} compact />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex justify-center">
          <div ref={mobileBoardRef} className="relative h-full" style={{ aspectRatio: '10 / 20' }}>
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
          {isActive && (
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
      <div className="hidden lg:flex items-start justify-center gap-8 px-4 py-8 max-w-[840px] mx-auto">
        <div className="flex flex-col gap-3 w-48">
          <GameStats
            score={displayScore}
            level={state.level}
            lines={state.lines}
            scoreCardRef={desktopScoreCardRef}
            scorePulseKey={scorePulseKey > 0 ? scorePulseKey : undefined}
          />
        </div>

        <div ref={desktopBoardRef} className="relative shrink-0 w-[360px]">
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

          {isActive && (
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

      <ScoreFlyEffect flights={scoreFlights} onArrive={handleFlightArrive} />
    </motion.div>
  );
}
