import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { THEME_STORAGE_KEY, DEFAULT_THEME } from "@/lib/theme";
import "./globals.css";

/**
 * No `icons` entry. `src/app/icon.png` is the App Router convention, and Next
 * emits the `<link rel="icon">` for it with a hashed, immutable URL. Pointing
 * `icons` at `/logo.png` made every visitor download the full header logo as a
 * favicon.
 */
export const metadata: Metadata = {
  title: "Bar Down Data — Hockey Versus",
  description: "NHL player head-to-head statistics when sharing ice time",
};

/**
 * Applies the saved theme before the first paint.
 *
 * The markup ships as light, so without this a visitor who chose dark would
 * see a white page flash on every navigation. It has to run synchronously in
 * the head, ahead of any stylesheet painting, which is why it is inline rather
 * than a module.
 *
 * Light is the default. A visitor with no saved choice gets light even if their
 * operating system prefers dark.
 *
 * `THEME_STORAGE_KEY` comes from `@/lib/theme`, not from the toggle component.
 * Importing it from a `"use client"` module gave a client reference rather than
 * the string, and this script silently read `localStorage.getItem(undefined)`.
 */
const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* `suppressHydrationWarning` because the script above may change
       `data-theme` before React hydrates. */
    <html lang="en" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-gray-950 text-gray-300 antialiased">
        <header className="sticky top-0 z-50 border-b border-[var(--color-header-border)]/60 bg-gray-950/80 backdrop-blur-lg">
          <div className="px-6 flex items-stretch gap-0">
            <Link href="/" className="shrink-0 py-2 pr-4 transition-opacity duration-200 hover:opacity-85">
              {/* Two files, one per theme. The wordmark is dark navy, which is
                  unreadable on a dark page, so the dark theme gets a lifted
                  variant. CSS picks one, so there is no hydration mismatch.
                  180x59 matches the 620x202 source ratio. */}
              <Image
                src="/logo.png"
                alt="Bar Down Data"
                width={180}
                height={59}
                className="only-light rounded"
                priority
              />
              <Image
                src="/logo-inverted.png"
                alt="Bar Down Data"
                width={180}
                height={59}
                className="only-dark rounded"
                priority
              />
            </Link>
            <NavLinks />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-screen-2xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
