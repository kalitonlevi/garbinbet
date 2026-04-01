"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Swords, Ticket, Wallet, User } from "lucide-react";

const navItems = [
  { href: "/fights", label: "Lutas", icon: Swords },
  { href: "/my-bets", label: "Apostas", icon: Ticket },
  { href: "/wallet", label: "Carteira", icon: Wallet },
  { href: "/profile", label: "Perfil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-default)]"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="max-w-[480px] mx-auto flex justify-around py-2 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors ${
                active ? "text-[#7ED957]" : "text-[#6B6B80]"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
