"use client";
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export default function OfflineBanner() {
  const isOnline = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[9999] bg-amber-500 text-white text-center py-2 px-4 text-sm font-semibold shadow-md"
    >
      📡 Sem conexão — exibindo dados salvos
    </div>
  );
}
