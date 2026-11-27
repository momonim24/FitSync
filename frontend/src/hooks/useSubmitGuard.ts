import { useCallback, useRef, useState } from 'react';

/**
 * Prevents duplicate submissions. `run(task)` ignores calls while a previous
 * task is still running — the check uses a ref, so even two clicks (or a
 * click plus an Enter key) delivered before React re-renders the disabled
 * button cannot send the request twice. `submitting` drives the button's
 * loading/disabled state.
 */
export function useSubmitGuard() {
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const run = useCallback(async (task: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      await task();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, []);
  return { submitting, run };
}
