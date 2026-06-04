"use client";

import dynamicImport from "next/dynamic";

const AgendaCalendar = dynamicImport(
  () => import("@/components/dashboard/agenda/agenda-calendar"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center rounded-xl border border-border bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  }
);

export default function AgendaWrapper() {
  return <AgendaCalendar />;
}
