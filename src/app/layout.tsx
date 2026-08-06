import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bar Down Data — Hockey Versus",
  description: "NHL player head-to-head statistics when sharing ice time",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <header className="sticky top-0 z-50 border-b border-[#1b2a4a]/60 bg-gray-950/80 backdrop-blur-lg">
          <div className="px-6 flex items-stretch gap-0">
            <Link href="/" className="shrink-0 py-2 pr-4 transition-opacity duration-200 hover:opacity-85">
              <Image
                src="/logo.png"
                alt="Bar Down Data"
                width={180}
                height={180}
                className="rounded"
              />
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="mx-auto max-w-screen-2xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
