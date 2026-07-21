"use client";

import Link from "next/link";
import { useEffect, useState, type ReactElement } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import Logo from "./Logo";

const COLLAPSE_KEY = "haiwan-nav-collapsed";

// Inline icons (Lucide-style, no dependency — disk is tight). Each is a 20x20
// stroked glyph that inherits `currentColor`.
type IconProps = { className?: string };
const ic = "h-5 w-5 shrink-0";
const Icons: Record<string, (p: IconProps) => ReactElement> = {
  dashboard: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>
  ),
  checklist: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m9 14 2 2 4-4" /></svg>
  ),
  pets: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045l-.4-1.2a3.5 3.5 0 0 0-.83-1.32l-1.32-1.32A2 2 0 0 1 6.5 12.5l.7-.7A5 5 0 0 1 9 10Z" /></svg>
  ),
  customers: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  members: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2" /><path d="M13 10h5" /><path d="M13 14h3" /><path d="M5.5 16a2.5 2.5 0 0 1 5 0" /></svg>
  ),
  transactions: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v6h6" /><path d="M4 6V4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2" /><path d="M2 13h10" /><path d="m9 16 3-3-3-3" /></svg>
  ),
  products: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
  ),
  brands: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
  ),
  analysis: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" /></svg>
  ),
  marketing: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
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
  catalog: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
  ),
  database: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></svg>
  ),
  chevronLeft: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
  ),
  chevronDown: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
  ),
  menu: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
  ),
  close: ({ className = ic }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  ),
};

type NavLink = { href: string; label: string; icon: keyof typeof Icons };
type NavGroup = { label: string; icon: keyof typeof Icons; children: NavLink[] };
type NavEntry = NavLink | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return "children" in e;
}

const ENTRIES: NavEntry[] = [
  { href: "/", label: "Inbox", icon: "dashboard" },
  { href: "/shift", label: "Shift checklist", icon: "checklist" },
  {
    label: "Customers",
    icon: "customers",
    children: [
      { href: "/customers", label: "Customer details", icon: "customers" },
      { href: "/pets", label: "Pet details", icon: "pets" },
      { href: "/members", label: "Membership", icon: "members" },
      { href: "/subscriptions", label: "Subscription", icon: "subscriptions" },
    ],
  },
  {
    label: "Catalog",
    icon: "catalog",
    children: [
      { href: "/products", label: "Products", icon: "products" },
      { href: "/brands", label: "Brands", icon: "brands" },
      { href: "/inventory", label: "Inventory", icon: "database" },
    ],
  },
  { href: "/transactions", label: "Transactions", icon: "transactions" },
  {
    label: "Insights",
    icon: "analysis",
    children: [
      { href: "/revenue", label: "Revenue mix", icon: "revenue" },
      { href: "/analysis", label: "Analysis", icon: "analysis" },
      { href: "/marketing", label: "Marketing", icon: "marketing" },
    ],
  },
  { href: "/whatsapp", label: "WhatsApp", icon: "whatsapp" },
  {
    label: "Data",
    icon: "database",
    children: [
      { href: "/import", label: "Import", icon: "import" },
      { href: "/export", label: "Export", icon: "export" },
    ],
  },
];

// Frontline staff only see these pages; management sees everything.
type Role = "management" | "frontline";
const FRONTLINE_HREFS = new Set(["/", "/shift", "/customers", "/pets", "/members", "/transactions", "/inventory"]);

function visibleEntries(role: Role): NavEntry[] {
  if (role === "management") return ENTRIES;
  const out: NavEntry[] = [];
  for (const e of ENTRIES) {
    if (isGroup(e)) {
      const children = e.children.filter((c) => FRONTLINE_HREFS.has(c.href));
      if (children.length) out.push({ ...e, children });
    } else if (FRONTLINE_HREFS.has(e.href)) {
      out.push(e);
    }
  }
  return out;
}

function NavLinks({
  entries,
  pathname,
  collapsed,
  onNavigate,
}: {
  entries: NavEntry[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // A group starts open when it contains the active route (computed from the
  // current path, so SSR and first client render agree — no hydration flash).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const e of entries) if (isGroup(e) && e.children.some((c) => isActive(c.href))) init[e.label] = true;
    return init;
  });

  // Keep the group holding the active route open as you navigate.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const e of entries) if (isGroup(e) && e.children.some((c) => isActive(c.href))) next[e.label] = true;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const renderLink = (l: NavLink, child: boolean) => {
    const Icon = Icons[l.icon];
    const active = isActive(l.href);
    return (
      <li key={l.href}>
        <Link
          href={l.href}
          onClick={onNavigate}
          title={collapsed ? l.label : undefined}
          className={`flex items-center rounded-md py-2 text-sm font-medium transition-colors ${
            collapsed ? "justify-center px-2" : `gap-3 ${child ? "pl-9 pr-3" : "px-3"}`
          } ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <Icon className={`${ic} ${active ? "text-white" : "text-slate-400"}`} />
          {!collapsed && <span className="truncate">{l.label}</span>}
        </Link>
      </li>
    );
  };

  return (
    <ul className="flex flex-col gap-0.5">
      {entries.map((e) => {
        if (!isGroup(e)) return renderLink(e, false);

        const Icon = Icons[e.icon];
        const groupActive = e.children.some((c) => isActive(c.href));
        const open = openGroups[e.label] ?? false;
        return (
          <li key={e.label}>
            <button
              type="button"
              onClick={() => setOpenGroups((p) => ({ ...p, [e.label]: !open }))}
              title={collapsed ? e.label : undefined}
              aria-expanded={open}
              className={`flex w-full items-center rounded-md py-2 text-sm font-medium transition-colors hover:bg-slate-100 ${
                collapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${groupActive ? "text-slate-900" : "text-slate-600"}`}
            >
              <Icon className={`${ic} ${groupActive ? "text-slate-900" : "text-slate-400"}`} />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-left">{e.label}</span>
                  <Icons.chevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                  />
                </>
              )}
            </button>
            {open && (
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {e.children.map((c) => renderLink(c, !collapsed))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function Nav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const entries = visibleEntries(role);

  // Restore the saved desktop preference once on mount (avoids SSR mismatch).
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  // No chrome on the login screen.
  if (pathname === "/login") return null;

  return (
    <>
      {/* ---- Mobile top bar (hidden on md+) ---- */}
      <header className="md:hidden fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="-ml-1 rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <Icons.menu className="h-6 w-6" />
        </button>
        <Link href="/" className="flex items-center gap-2" aria-label="Haiwan CRM home">
          <Logo className="h-5 w-auto text-slate-900" />
          <span className="border-l border-slate-200 pl-2 text-[10px] font-medium uppercase tracking-widest text-slate-400">
            CRM
          </span>
        </Link>
      </header>

      {/* ---- Mobile drawer + backdrop (hidden on md+) ---- */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 shrink-0">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2"
                aria-label="Haiwan CRM home"
              >
                <Logo className="h-5 w-auto text-slate-900" />
                <span className="border-l border-slate-200 pl-2 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                  CRM
                </span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <Icons.close className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3">
              <NavLinks entries={entries} pathname={pathname} collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </nav>

            <div className="border-t border-slate-200 p-3 shrink-0">
              <form action={logout}>
                <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
                  <Icons.logout className={`${ic} text-slate-400`} />
                  <span>Log out</span>
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}

      {/* ---- Desktop sidebar (hidden below md) ---- */}
      <aside
        className={`hidden md:flex sticky top-0 z-20 h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <Link
          href="/"
          className={`flex h-14 items-center border-b border-slate-200 shrink-0 ${
            collapsed ? "justify-center px-2" : "gap-2 px-4"
          }`}
          aria-label="Haiwan CRM home"
          title="Haiwan CRM"
        >
          {collapsed ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
              H
            </span>
          ) : (
            <>
              <Logo className="h-5 w-auto text-slate-900" />
              <span className="border-l border-slate-200 pl-2 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                CRM
              </span>
            </>
          )}
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <NavLinks entries={entries} pathname={pathname} collapsed={collapsed} />
        </nav>

        <div className="border-t border-slate-200 p-3 shrink-0">
          <button
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`mb-1 flex w-full items-center rounded-md py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 ${
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            }`}
          >
            <Icons.chevronLeft
              className={`${ic} text-slate-400 transition-transform duration-200 ${
                collapsed ? "rotate-180" : ""
              }`}
            />
            {!collapsed && <span>Collapse</span>}
          </button>

          <form action={logout}>
            <button
              title={collapsed ? "Log out" : undefined}
              className={`flex w-full items-center rounded-md py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 ${
                collapsed ? "justify-center px-2" : "gap-3 px-3"
              }`}
            >
              <Icons.logout className={`${ic} text-slate-400`} />
              {!collapsed && <span>Log out</span>}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
