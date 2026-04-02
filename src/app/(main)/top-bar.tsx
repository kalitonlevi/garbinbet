"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import type { Profile } from "@/types/database";

export function MainTopBar({
  profile,
  balance,
}: {
  profile: Profile;
  balance: number;
}) {
  const pathname = usePathname();
  const isAdmin = profile.role === "admin";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-default)]"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="max-w-[480px] mx-auto flex items-center justify-between h-14 px-4">
        {/* Left: balance */}
        <div className="text-left min-w-[80px]">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Saldo
          </p>
          <p className="text-sm font-bold text-[#D4A017]">
            R$ {balance.toFixed(2)}
          </p>
        </div>

        {/* Center: logo */}
        <Link href="/fights" className="flex-shrink-0">
          <Image
            src="/logo.png"
            alt="GARBINBET"
            width={360}
            height={100}
            className="h-18 md:h-22 w-auto object-contain"
            priority
          />
        </Link>

        {/* Right: admin link or spacer */}
        <div className="min-w-[80px] flex justify-end">
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-[#D4A017] text-[#0A0A0F]"
                  : "text-[#D4A017] hover:bg-[#D4A017]/10"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
