import { useEffect, useState } from 'react';

// Counts down while `isRunning` is true; pausing playback pauses the clock
// too, so "N minutes" means N minutes of actual practice, not wall time.
// `totalSeconds` of `null` means "no timer" (untimed session).
export function useCountdown(totalSeconds, isRunning) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds ?? 0);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setSecondsLeft(totalSeconds ?? 0);
    setExpired(false);
  }, [totalSeconds]);

  useEffect(() => {
    if (totalSeconds == null || !isRunning || expired) return undefined;

    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setExpired(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [totalSeconds, isRunning, expired]);

  const reset = () => {
    setSecondsLeft(totalSeconds ?? 0);
    setExpired(false);
  };

  return { secondsLeft, expired, reset };
}
