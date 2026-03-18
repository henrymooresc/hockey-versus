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
        <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <a href="/" className="text-2xl font-bold tracking-tight">
              Hockey <span className="text-blue-400">Versus</span>
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
