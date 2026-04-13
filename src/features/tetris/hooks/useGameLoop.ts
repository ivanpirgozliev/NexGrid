import { useEffect, useRef } from 'react';

export function useGameLoop(callback: () => void, intervalMs: number, active: boolean) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => callbackRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
}
