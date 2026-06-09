"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import Logo from "./Logo";

// Inline icons (Lucide-style, no dependency — disk is tight). Each is a 20x20
// stroked glyph that inherits `currentColor`.
type IconProps = { className?: string };
const ic = "h-5 w-5 shrink-0";
const Icons: Record<string, (p: IconProps) => ReactElement> = {
  dashboard: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>
  ),
  pets: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045l-.4-1.2a3.5 3.5 0 0 0-.83-1.32l-1.32-1.32A2 2 0 0 1 6.5 12.5l.7-.7A5 5 0 0 1 9 10Z" /></svg>
  ),
  customers: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  transactions: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v6h6" /><path d="M4 6V4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2" /><path d="M2 13h10" /><path d="m9 16 3-3-3-3" /></svg>
  ),
  products: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
  ),
  analysis: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" /></svg>
  ),
  revenue: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z" /><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /></svg>
  ),
  subscriptions: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6" /><path d="M21 12A9 9 0 0 0 6 5.3L3 8" /><path d="M21 22v-6h-6" /><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" /></svg>
  ),
  whatsapp: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
  ),
  import: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></svg>
  ),
  export: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m8 7 4-4 4 4" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></svg>
  ),
  logout: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
  ),
};

const LINKS: Array<{ href: string; label: string; icon: keyof typeof Icons }> = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/pets", label: "Pets", icon: "pets" },
  { href: "/customers", label: "Customers", icon: "customers" },
  { href: "/transactions", label: "Transactions", icon: "transactions" },
  { href: "/products", label: "Products", icon: "products" },
  { href: "/analysis", label: "Analysis", icon: "analysis" },
  { href: "/revenue", label: "Revenue mix", icon: "revenue" },
  { href: "/subscriptions", label: "Subscriptions", icon: "subscriptions" },
  { href: "/whatsapp", label: "WhatsApp", icon: "whatsapp" },
  { href: "/import", label: "Import", icon: "import" },
  { href: "/export", label: "Export", icon: "export" },
];

export default function Nav() {
  const pathname = usePathname();

  // No chrome on the login screen.
  if (pathname === "/login") return null;

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="sticky top-0 z-20 flex h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <Link
        href="/"
        className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 shrink-0"
        aria-label="Haiwan CRM home"
      >
        <Logo className="h-5 w-auto text-slate-900" />
        <span className="border-l border-slate-200 pl-2 text-[10px] font-medium uppercase tracking-widest text-slate-400">
          CRM
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {LINKS.map((l) => {
            const Icon = Icons[l.icon];
            const active = isActive(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`${ic} ${active ? "text-white" : "text-slate-400"}`} />
                  <span className="truncate">{l.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action={logout} className="border-t border-slate-200 p-3 shrink-0">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100">
          <Icons.logout className={`${ic} text-slate-400`} />
          <span>Log out</span>
        </button>
      </form>
    </aside>
  );
}
