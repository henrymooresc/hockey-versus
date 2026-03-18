import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hockey Versus",
  description: "NHL player head-to-head statistics when sharing ice time",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <header className="sticky top-0 z-50 border-b border-gray-800/50 bg-gray-950/70 backdrop-blur-lg">
          <div className="mx-auto max-w-7xl px-6 py-5">
            <a href="/" className="group text-3xl font-bold tracking-tight transition-opacity duration-200 hover:opacity-80">
              Hockey <span className="text-blue-400 transition-colors duration-200 group-hover:text-blue-300">Versus</span>
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
