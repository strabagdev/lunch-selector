"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminLinks = [
  { href: "/admin", label: "Resumen", shortLabel: "Resumen" },
  { href: "/admin/people", label: "Personas", shortLabel: "Personas" },
  { href: "/admin/menu-config", label: "Menú", shortLabel: "Menú" },
  { href: "/admin/menu-days", label: "Histórico", shortLabel: "Histórico" },
  { href: "/admin/selections", label: "Trazabilidad", shortLabel: "Trazas" },
];

type AdminNavProps = {
  variant?: "side" | "bottom";
};

export default function AdminNav({ variant = "side" }: AdminNavProps) {
  const pathname = usePathname();
  const isBottom = variant === "bottom";

  return (
    <nav
      className={
        isBottom
          ? "grid grid-cols-5 gap-1 rounded-[24px] border border-border bg-[rgba(18,21,27,0.96)] p-1.5 shadow-[var(--shadow-card)] backdrop-blur lg:hidden"
          : "flex flex-col gap-2"
      }
    >
      {adminLinks.map((link) => {
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`border text-sm font-semibold transition-colors ${
              isBottom ? "rounded-[18px] px-1 py-2 text-center text-[10px]" : "rounded-[18px] px-4 py-3"
            } ${
              isActive
                ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_0_0_1px_var(--accent-border)]"
                : "border-transparent bg-transparent text-muted hover:bg-[var(--surface-strong)] hover:text-foreground"
            }`}
          >
            {isBottom ? link.shortLabel : link.label}
          </Link>
        );
      })}
    </nav>
  );
}
