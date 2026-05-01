"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/compare", label: "Compare" },
  { href: "/incentives", label: "Incentives" },
  { href: "/history", label: "History" },
  { href: "/map", label: "Map" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link ${active ? "nav-link-active" : ""}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
