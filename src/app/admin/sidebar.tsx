"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Trophy,
  Users,
  Swords,
  Target,
  UserCog,
  ArrowLeft,
  Menu,
  X,
  Banknote,
} from "lucide-react";

const sidebarLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/events", label: "Eventos", icon: Trophy },
  { href: "/admin/fighters", label: "Lutadores", icon: Users },
  { href: "/admin/fights", label: "Lutas", icon: Swords },
  { href: "/admin/settle", label: "Apurar Resultados", icon: Target },
  { href: "/admin/users", label: "Usuarios", icon: UserCog },
  { href: "/admin/withdrawals", label: "Saques", icon: Banknote },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const navContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-[var(--border-default)]">
        <Link href="/admin" className="block">
          <Image
            src="/logo.png"
            alt="GARBINBET"
            width={120}
            height={120}
            className="rounded-lg mx-auto"
          />
        </Link>
        <p className="text-[10px] text-[var(--brand-gold)] mt-3 uppercase tracking-[0.2em] font-bold text-center">
          Painel Administrativo
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1">
        {sidebarLinks.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
            >
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-[#7ED957]/15 text-white border-l-2 border-[var(--brand-green)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    active ? "text-[var(--brand-green)]" : ""
                  }`}
                />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Back link */}
      <div className="p-3 border-t border-[var(--border-default)]">
        <Link href="/fights" onClick={() => setMobileOpen(false)}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </div>
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-60 border-r border-[var(--border-default)] min-h-screen shrink-0 sticky top-0 h-screen overflow-y-auto"
        style={{ background: "#111118" }}
      >
        {navContent}
      </aside>

      {/* Mobile hamburger button */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-default)] h-14 flex items-center px-4 justify-between"
        style={{ background: "#111118" }}
      >
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-[var(--text-primary)] p-1"
        >
          {mobileOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="GARBINBET"
            width={28}
            height={28}
            className="rounded"
          />
          <span className="text-xs font-bold text-[var(--brand-gold)] uppercase tracking-wider">
            Admin
          </span>
        </div>
        <Link
          href="/fights"
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="md:hidden fixed top-14 left-0 bottom-0 z-50 w-64 flex flex-col overflow-y-auto"
            style={{ background: "#111118" }}
          >
            {navContent}
          </aside>
        </>
      )}

      {/* Mobile spacer */}
      <div className="md:hidden h-14 shrink-0" />
    </>
  );
}
