"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ControlesSectionNav() {
  const pathname = usePathname();
  const isPericia = pathname.startsWith("/dashboard/pericias");

  const tab =
    "relative pb-2.5 px-1 text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:transition-colors";
  const active = "text-primary after:bg-primary";
  const inactive = "text-muted hover:text-fg after:bg-transparent";

  return (
    <div className="flex gap-6 border-b border-border">
      <Link
        href="/dashboard/controles"
        className={`${tab} ${!isPericia ? active : inactive}`}
      >
        Controles
      </Link>
      <Link
        href="/dashboard/pericias"
        className={`${tab} ${isPericia ? active : inactive}`}
      >
        Perícias
      </Link>
    </div>
  );
}
