import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/http";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

type Settled<T> = Exclude<LoadState<T>, { status: "loading" }>;

// Loads data when the component appears and again whenever `key` changes.
// `key` identifies the request (e.g. the filter query string): a new key means
// "fetch again". When the key changes before the previous request finished,
// that request is cancelled and its late answer is ignored, so an old,
// slower response can never overwrite a newer one.
export function useApiData<T>(load: (signal: AbortSignal) => Promise<T>, key: string) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${key}#${attempt}`;

  // Each answer is stored together with the request it answers.
  const [result, setResult] = useState<{ requestKey: string; state: Settled<T> } | null>(null);

  // Always call the latest `load` without making it an effect dependency.
  // (Updated in an effect, not during render; effects run in order, so this one runs first.)
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();

    loadRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ requestKey, state: { status: "ready", data } });
      },
      (err: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ requestKey, state: { status: "error", message: errorMessage(err) } });
        }
      },
    );

    return () => controller.abort();
  }, [requestKey]);

  // "Loading" is not stored: it simply means we have no answer for the current request yet.
  const state: LoadState<T> =
    result && result.requestKey === requestKey ? result.state : { status: "loading" };

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}
