/**
 * Where the chosen theme is remembered.
 *
 * This lives in a plain module rather than in `ThemeToggle`. That component is
 * marked `"use client"`, and a server component importing a plain constant from
 * a client module receives a client reference, not the value. The inline script
 * in `layout.tsx` read `undefined` as a result, so a saved theme was silently
 * ignored on every page load.
 */
export const THEME_STORAGE_KEY = "theme";

export type Theme = "light" | "dark";

/** The theme used when a visitor has made no choice. */
export const DEFAULT_THEME: Theme = "light";
