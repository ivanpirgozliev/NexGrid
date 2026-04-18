import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { GameState, Tetromino } from '../types';
import {
  createEmptyBoard,
  isValidPosition,
  mergeTetromino,
  findFullRows,
  removeRows,
  getBoardWithGhost,
} from '../utils/board';
import {
  createTetromino,
  randomTetrominoType,
  rotateTetromino,
} from '../utils/tetrominos';
import { calculateScore, calculateLevel, calculateDropInterval } from '../utils/scoring';
import { useGameLoop } from './useGameLoop';

const CLEAR_ANIMATION_MS = 400;

type Action =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'MOVE_LEFT' }
  | { type: 'MOVE_RIGHT' }
  | { type: 'MOVE_DOWN' }
  | { type: 'ROTATE' }
  | { type: 'HARD_DROP' }
  | { type: 'TICK' }
  | { type: 'RESET' }
  | { type: 'FINISH_CLEAR' };

function initState(): GameState {
  return {
    board: createEmptyBoard(),
    current: null,
    next: randomTetrominoType(),
    score: 0,
    level: 1,
    lines: 0,
    status: 'idle',
    clearedRows: [],
  };
}

function spawnNext(state: GameState): GameState {
  const newPiece = createTetromino(state.next);
  const nextType = randomTetrominoType();
  if (!isValidPosition(state.board, newPiece)) {
    return { ...state, status: 'over', current: null };
  }
  return { ...state, current: newPiece, next: nextType };
}

function lockPiece(state: GameState): GameState {
  if (!state.current) return state;
  const merged = mergeTetromino(state.board, state.current);
  const fullRows = findFullRows(merged);

  if (fullRows.length > 0) {
    return {
      ...state,
      board: merged,
      current: null,
      clearedRows: fullRows,
      status: 'clearing',
    };
  }

  const newState: GameState = {
    ...state,
    board: merged,
    current: null,
    clearedRows: [],
  };
  return spawnNext(newState);
}

function finishClear(state: GameState): GameState {
  const { board: clearedBoard, clearedCount } = removeRows(state.board, state.clearedRows);
  const newLines = state.lines + clearedCount;
  const newLevel = calculateLevel(newLines);
  const newScore = state.score + calculateScore(clearedCount, newLevel);
  const interim: GameState = {
    ...state,
    board: clearedBoard,
    score: newScore,
    level: newLevel,
    lines: newLines,
    current: null,
    clearedRows: [],
    status: 'playing',
  };
  return spawnNext(interim);
}

function tryMove(state: GameState, tetromino: Tetromino): GameState {
  if (isValidPosition(state.board, tetromino)) {
    return { ...state, current: tetromino };
  }
  return state;
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START': {
      const next = randomTetrominoType();
      const current = createTetromino(state.next);
      return { ...initState(), current, next, status: 'playing' };
    }
    case 'RESET':
      return initState();
    case 'PAUSE':
      return state.status === 'playing' ? { ...state, status: 'paused' } : state;
    case 'RESUME':
      return state.status === 'paused' ? { ...state, status: 'playing' } : state;
    case 'MOVE_LEFT': {
      if (!state.current || state.status !== 'playing') return state;
      const moved = { ...state.current, position: { ...state.current.position, x: state.current.position.x - 1 } };
      return tryMove(state, moved);
    }
    case 'MOVE_RIGHT': {
      if (!state.current || state.status !== 'playing') return state;
      const moved = { ...state.current, position: { ...state.current.position, x: state.current.position.x + 1 } };
      return tryMove(state, moved);
    }
    case 'MOVE_DOWN':
    case 'TICK': {
      if (!state.current || state.status !== 'playing') return state;
      const moved = { ...state.current, position: { ...state.current.position, y: state.current.position.y + 1 } };
      if (isValidPosition(state.board, moved)) {
        return { ...state, current: moved };
      }
      return lockPiece(state);
    }
    case 'ROTATE': {
      if (!state.current || state.status !== 'playing') return state;
      const rotated = rotateTetromino(state.current);
      if (isValidPosition(state.board, rotated)) return { ...state, current: rotated };
      const kickRight = { ...rotated, position: { ...rotated.position, x: rotated.position.x + 1 } };
      if (isValidPosition(state.board, kickRight)) return { ...state, current: kickRight };
      const kickLeft = { ...rotated, position: { ...rotated.position, x: rotated.position.x - 1 } };
      if (isValidPosition(state.board, kickLeft)) return { ...state, current: kickLeft };
      return state;
    }
    case 'HARD_DROP': {
      if (!state.current || state.status !== 'playing') return state;
      const { ghostY } = getBoardWithGhost(state.board, state.current);
      const dropped = { ...state.current, position: { ...state.current.position, y: ghostY } };
      return lockPiece({ ...state, current: dropped });
    }
    case 'FINISH_CLEAR': {
      if (state.status !== 'clearing') return state;
      return finishClear(state);
    }
    default:
      return state;
  }
}

export function useTetris() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const dropInterval = calculateDropInterval(state.level);
  const isPlaying = state.status === 'playing';

  useGameLoop(() => dispatch({ type: 'TICK' }), dropInterval, isPlaying);

  useEffect(() => {
    if (state.status === 'clearing') {
      clearTimerRef.current = setTimeout(() => {
        dispatch({ type: 'FINISH_CLEAR' });
      }, CLEAR_ANIMATION_MS);
      return () => clearTimeout(clearTimerRef.current);
    }
  }, [state.status]);

  const ghostY = state.current
    ? getBoardWithGhost(state.board, state.current).ghostY
    : null;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (state.status === 'clearing') return;
      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          dispatch({ type: 'MOVE_LEFT' });
          break;
        case 'ArrowRight':
          e.preventDefault();
          dispatch({ type: 'MOVE_RIGHT' });
          break;
        case 'ArrowDown':
          e.preventDefault();
          dispatch({ type: 'MOVE_DOWN' });
          break;
        case 'ArrowUp':
        case 'KeyX':
          e.preventDefault();
          dispatch({ type: 'ROTATE' });
          break;
        case 'Space':
          e.preventDefault();
          dispatch({ type: 'HARD_DROP' });
          break;
        case 'Escape':
        case 'KeyP':
          e.preventDefault();
          if (state.status === 'playing') dispatch({ type: 'PAUSE' });
          else if (state.status === 'paused') dispatch({ type: 'RESUME' });
          break;
      }
    },
    [state.status]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    state,
    ghostY,
    dispatch,
    start: () => dispatch({ type: 'START' }),
    pause: () => dispatch({ type: 'PAUSE' }),
    resume: () => dispatch({ type: 'RESUME' }),
    reset: () => dispatch({ type: 'RESET' }),
    hardDrop: () => dispatch({ type: 'HARD_DROP' }),
  };
}
