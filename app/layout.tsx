import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Haiwan CRM",
  description: "Internal pet-centric CRM for Haiwan",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-slate-50 text-slate-900">
        <Nav />
        <div className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0">
          <main className="flex-1 w-full max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6">{children}</main>
          <footer className="border-t border-slate-200 bg-white text-xs text-slate-500 py-3">
            <div className="max-w-7xl mx-auto px-4">
              Haiwan CRM — temporary internal tool. The SQLite database
              (<code className="font-mono">data/haiwan.db</code>) and
              <code className="font-mono"> prisma/schema.prisma</code> are the migration
              handoff for the future system. Use the Export page to extract all data as CSV.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
