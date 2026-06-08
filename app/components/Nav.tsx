"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import Logo from "./Logo";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Dashboard" },
  { href: "/pets", label: "Pets" },
  { href: "/customers", label: "Customers" },
  { href: "/transactions", label: "Transactions" },
  { href: "/products", label: "Products" },
  { href: "/wix", label: "Wix" },
  { href: "/analysis", label: "Analysis" },
  { href: "/revenue", label: "Revenue mix" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/import", label: "Import" },
  { href: "/export", label: "Export" },
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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
        <Link href="/" className="flex items-center gap-2 mr-5 shrink-0" aria-label="Haiwan CRM home">
          <Logo className="h-5 w-auto text-slate-900" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 border-l border-slate-200 pl-2">
            CRM
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                isActive(l.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <form action={logout} className="ml-auto shrink-0">
          <button className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-500 hover:bg-slate-100 whitespace-nowrap">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
