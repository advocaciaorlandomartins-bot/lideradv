"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] erro:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-xl border border-red-200 bg-red-50 px-8 py-6 dark:border-red-800 dark:bg-red-950">
        <h2 className="mb-2 text-lg font-semibold text-red-700 dark:text-red-300">
          Algo deu errado
        </h2>
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error.message || "Ocorreu um erro inesperado. Tente novamente."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
