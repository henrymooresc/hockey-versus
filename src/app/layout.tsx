import type { Metadata } from "next";
import Image from "next/image";
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
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
            <a href="/" className="group transition-opacity duration-200 hover:opacity-85">
              <Image
                src="/logo.png"
                alt="Bar Down Data"
                width={180}
                height={180}
                className="rounded"
              />
            </a>
            <nav className="flex items-center gap-6">
              <a
                href="/"
                className="text-sm font-semibold uppercase tracking-widest text-[#5a7baa] transition-colors duration-200 hover:text-[#a62639]"
              >
                Hockey Versus
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
