"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const links = [
  { href: "/", label: "Hockey Versus" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/games", label: "Games" },
  { href: "/about", label: "About" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    /**
     * The links scroll sideways when they do not fit, rather than pushing the
     * page wider. Below about 700px the logo and four links exceed the screen,
     * and the whole page scrolled sideways before this.
     *
     * `min-w-0` is what makes it work. A flex item defaults to
     * `min-width: auto`, which refuses to shrink below its content, so
     * `overflow-x-auto` alone would do nothing here.
     *
     * The scrollbar is hidden. It would only ever appear on a touch screen,
     * where swiping is the natural gesture, and a visible bar inside a sticky
     * header looks broken.
     */
    <nav className="flex min-w-0 flex-1 self-stretch items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {links.map(({ href, label }) => {
        const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            /* Brand chrome comes from theme variables, so the nav follows the
               light and dark themes with the rest of the site. */
            className={`flex shrink-0 items-center whitespace-nowrap px-5 text-base font-semibold uppercase tracking-widest border-b-2 transition-colors duration-200 ${
              isActive
                ? "border-[var(--color-brand-red)] bg-[var(--color-nav-active-bg)]/40 text-gray-100"
                : "border-transparent text-[var(--color-nav-link)] hover:bg-[var(--color-nav-active-bg)]/20 hover:text-gray-200"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
