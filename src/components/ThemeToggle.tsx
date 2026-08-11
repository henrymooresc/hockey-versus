"use client";

import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Switches between the light and dark themes.
 *
 * There is no React state here on purpose. The theme lives in one place, the
 * `data-theme` attribute on `<html>`, and CSS decides which icon to show. That
 * keeps the server and client markup identical, so hydration cannot mismatch,
 * and the correct icon is painted before this component ever hydrates.
 *
 * The choice is written to localStorage and re-applied by the inline script in
 * `layout.tsx`, which runs before the first paint.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode, or storage is full. The theme still applies for this
      // page view; it just will not be remembered.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Switch between light and dark"
      aria-label="Switch between light and dark theme"
      className="flex shrink-0 items-center self-center rounded-md border border-gray-700 bg-gray-800/60 p-2 text-gray-500 transition-colors hover:border-gray-600 hover:text-gray-300"
    >
      {/* Shown on the light theme: click to go dark. */}
      <svg
        className="only-light"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      {/* Shown on the dark theme: click to go light. */}
      <svg
        className="only-dark"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    </button>
  );
}
