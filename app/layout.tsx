import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Release Pilot",
  description: "Daily MCP-powered release and health digests for PMs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="app-shell">
          <header className="app-nav">
            <div>
              <p className="eyebrow">Release Pilot</p>
              <h1>Daily release digest</h1>
            </div>
            <div className="nav-actions">
              <button type="button">Admin</button>
              <button type="button" className="primary">
                Trigger digest
              </button>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
