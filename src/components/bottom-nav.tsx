"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Swords,
  Ticket,
  Wallet,
  User,
  Users,
  GitBranch,
  Bomb,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Swords;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/fights", label: "Lutas", icon: Swords },
  { href: "/brackets", label: "Chaves", icon: GitBranch },
  { href: "/fighters", label: "Atletas", icon: Users },
  { href: "/mines", label: "Mines", icon: Bomb, adminOnly: true },
  { href: "/my-bets", label: "Apostas", icon: Ticket },
  { href: "/wallet", label: "Carteira", icon: Wallet },
  { href: "/profile", label: "Perfil", icon: User },
];

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-default)]"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="max-w-[480px] mx-auto flex justify-around py-2 px-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1 text-[10px] font-medium transition-colors ${
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
