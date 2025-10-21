import { useState, useEffect } from "react";

/**
 * Hook for managing controlled Tabs state with automatic fallback to the first available tab.
 * This prevents the common issue where Radix tabs appear blank when the controlled value
 * doesn't match any available trigger (e.g., after conditional rendering, data loading, etc.)
 * 
 * @param availableKeys - Array of available tab keys (trigger values)
 * @param initialKey - Optional initial key (defaults to first available key)
 * @returns [currentValue, setValue] tuple for use with Tabs component
 */
export function useTabsState(
  availableKeys: string[],
  initialKey?: string
): [string, (value: string) => void] {
  const validInitial = initialKey && availableKeys.includes(initialKey) 
    ? initialKey 
    : availableKeys[0] || "";

  const [value, setValue] = useState<string>(validInitial);

  useEffect(() => {
    if (!value || !availableKeys.includes(value)) {
      setValue(availableKeys[0] || "");
    }
  }, [availableKeys.join(","), value]);

  return [value, setValue];
}
