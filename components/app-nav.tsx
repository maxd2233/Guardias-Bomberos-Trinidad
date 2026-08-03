"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Tablero" },
  { href: "/historial", label: "Historial" },
];

export function AppNav({ oficial = false }: { oficial?: boolean }) {
  const pathname = usePathname();
  const items = [
    ...ITEMS,
    ...(oficial ? [{ href: "/admin", label: "Administración" }] : []),
  ];
  return (
    <nav
      aria-label="Secciones"
      className="flex items-center gap-1 overflow-x-auto"
    >
      {items.map((item) => {
        const activo =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activo ? "page" : undefined}
            className={`inline-flex min-h-11 items-center px-3 font-semibold transition-colors duration-150 ${
              activo
                ? "text-fire shadow-[inset_0_-2px_0_0_var(--color-fire)]"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
