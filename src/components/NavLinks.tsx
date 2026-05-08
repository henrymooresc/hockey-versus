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
    <nav className="flex self-stretch items-stretch">
      {links.map(({ href, label }) => {
        const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center px-5 text-sm font-semibold uppercase tracking-widest border-b-2 transition-colors duration-200 ${
              isActive
                ? "border-[#a62639] text-white bg-[#1b2a4a]/40"
                : "border-transparent text-[#5a7baa] hover:bg-[#1b2a4a]/20 hover:text-gray-200"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
