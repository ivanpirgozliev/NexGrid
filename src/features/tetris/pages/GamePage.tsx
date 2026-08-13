import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { useTetris } from '../hooks/useTetris';
import { useSaveScore } from '../hooks/useSaveScore';
import { useGameAudio } from '../hooks/useGameAudio';
import { AudioControls } from '../components/AudioControls';
import { Board } from '../components/Board';
import { GameStats } from '../components/GameStats';
import { NextPiece } from '../components/NextPiece';
import { GameOverlay } from '../components/GameOverlay';
import { Controls } from '../components/Controls';
import { ScoreFlyEffect, type ScoreFlight } from '../components/ScoreFlyEffect';
import { Button } from '../../../components/ui/Button';

const BOARD_ROWS = 20;
const AUDIO_PREFS_KEY = 'tetris_audio_prefs_v1';

/** Comfortably longer than the 0.9s score-fly animation in ScoreFlyEffect. */
const SCORE_RECONCILE_MS = 1500;

interface AudioPrefs {
  masterVolume: number;
  effectsVolume: number;
  muted: boolean;
}

const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  masterVolume: 0.8,
  effectsVolume: 0.9,
  muted: false,
};

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function readAudioPrefs(): AudioPrefs {
  if (typeof window === 'undefined') {
    return DEFAULT_AUDIO_PREFS;
  }

  const raw = window.localStorage.getItem(AUDIO_PREFS_KEY);
  if (!raw) {
    return DEFAULT_AUDIO_PREFS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
    return {
      masterVolume: clampVolume(parsed.masterVolume ?? DEFAULT_AUDIO_PREFS.masterVolume),
      effectsVolume: clampVolume(parsed.effectsVolume ?? DEFAULT_AUDIO_PREFS.effectsVolume),
      muted: parsed.muted ?? DEFAULT_AUDIO_PREFS.muted,
    };
  } catch {
    return DEFAULT_AUDIO_PREFS;
  }
}


export function GamePage() {
  const { state, start, pause, resume } = useTetris();
  const [audioPrefs, setAudioPrefs] = useState<AudioPrefs>(() => readAudioPrefs());
  const { playLineClear, playScoreCollect, playLevelUp } = useGameAudio(audioPrefs);
  const isActive =
    state.status === 'playing' ||
    state.status === 'clearing' ||
    state.status === 'paused';
  const canPause = state.status === 'playing' || state.status === 'clearing';
  const { saveScore, resetSaved, startSession, saveError } = useSaveScore(isActive);

  const [displayScore, setDisplayScore] = useState(state.score);
  const [scoreFlights, setScoreFlights] = useState<ScoreFlight[]>([]);
  const [scorePulseKey, setScorePulseKey] = useState(0);

  const boardRef = useRef<HTMLDivElement>(null);
  const scoreCardRef = useRef<HTMLDivElement>(null);

  const clearOriginRef = useRef<{ x: number; y: number } | null>(null);
  const prevScoreRef = useRef(state.score);
  const prevLinesRef = useRef(state.lines);
  const prevLevelRef = useRef(state.level);
  const flightIdRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(audioPrefs));
  }, [audioPrefs]);

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

    const boardElement = boardRef.current;
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
      const scoreCardElement = scoreCardRef.current;

      if (linesDelta > 0 && scoreCardElement) {
        const scoreRect = scoreCardElement.getBoundingClientRect();
        const boardElement = boardRef.current;
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

  /*
    The flying "+points" animation is decorative, but displayScore only advances
    when a flight reports arrival. framer-motion does not guarantee
    onAnimationComplete — an interrupted or never-finished animation silently
    swallows its points, and the score card then disagrees with the real score
    for the rest of the game.

    So the card is reconciled on a timer instead of on flights draining: every
    change restarts it, and once the score stops moving the card snaps to the
    truth regardless of what the animations did.
  */
  useEffect(() => {
    if (displayScore === state.score) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setScoreFlights([]);
      setDisplayScore(state.score);
    }, SCORE_RECONCILE_MS);

    return () => window.clearTimeout(timeout);
  }, [displayScore, state.score]);

  // Game over is the one moment the number is read carefully, so do not wait
  // out the timer there.
  useEffect(() => {
    if (state.status === 'over') {
      setScoreFlights([]);
      setDisplayScore(state.score);
    }
  }, [state.status, state.score]);

  const handleFlightArrive = useCallback(
    (flight: ScoreFlight) => {
      setScoreFlights((prev) => prev.filter((item) => item.id !== flight.id));
      setDisplayScore((prev) => prev + flight.points);
      setScorePulseKey((prev) => prev + 1);
      playScoreCollect(flight.points);
    },
    [playScoreCollect]
  );

  const handleToggleMute = useCallback(() => {
    setAudioPrefs((prev) => ({
      ...prev,
      muted: !prev.muted,
    }));
  }, []);

  const handleMasterVolumeChange = useCallback((value: number) => {
    const nextValue = clampVolume(value);
    setAudioPrefs((prev) => ({
      ...prev,
      masterVolume: nextValue,
      muted: prev.muted && nextValue > 0 ? false : prev.muted,
    }));
  }, []);

  const handleEffectsVolumeChange = useCallback((value: number) => {
    const nextValue = clampVolume(value);
    setAudioPrefs((prev) => ({
      ...prev,
      effectsVolume: nextValue,
      muted: prev.muted && nextValue > 0 ? false : prev.muted,
    }));
  }, []);

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

      {/*
        The board takes the available vertical space and derives its width from
        the 10:20 aspect ratio. The side columns are top-aligned rather than
        stretched, so their cards sit level with the top of the board.
      */}
      <div className="flex items-start justify-center gap-8 px-4 py-6 h-[calc(100dvh-64px)]">
        <div className="flex flex-col gap-3 w-48 shrink-0">
          <GameStats
            score={displayScore}
            level={state.level}
            lines={state.lines}
            scoreCardRef={scoreCardRef}
            scorePulseKey={scorePulseKey > 0 ? scorePulseKey : undefined}
          />
        </div>

        <div
          ref={boardRef}
          className="relative shrink-0 h-full max-h-full"
          style={{ aspectRatio: '10 / 20' }}
        >
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

        <div className="flex flex-col gap-3 w-48 shrink-0">
          <NextPiece type={state.next} />

          {canPause && (
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

          <AudioControls
            muted={audioPrefs.muted}
            masterVolume={audioPrefs.masterVolume}
            effectsVolume={audioPrefs.effectsVolume}
            onToggleMute={handleToggleMute}
            onMasterVolumeChange={handleMasterVolumeChange}
            onEffectsVolumeChange={handleEffectsVolumeChange}
          />

          <Controls />
        </div>
      </div>

      <ScoreFlyEffect flights={scoreFlights} onArrive={handleFlightArrive} />
    </motion.div>
  );
}
