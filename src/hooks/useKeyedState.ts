"use client";

import { useCallback, useState } from "react";

/**
 * State that returns to `initial` whenever `key` changes.
 *
 * Panels need this for a selection that belongs to one request: the open tab,
 * the expanded row, the chosen pair. Each used to reset inside the fetch
 * effect, which `react-hooks/set-state-in-effect` warns about.
 *
 * The reset happens by derivation, not by a second write. The stored value
 * carries the key it was set under, so a new key stops matching and the
 * initial value shows again. Adjusting state during render would also work,
 * but `react-hooks/set-state-in-render` is an error in this config.
 */
export function useKeyedState<T>(
  key: string,
  initial: T
): [T, (value: T) => void] {
  const [stored, setStored] = useState<{ key: string; value: T } | null>(null);

  const value = stored?.key === key ? stored.value : initial;
  const setValue = useCallback((next: T) => setStored({ key, value: next }), [key]);

  return [value, setValue];
}
