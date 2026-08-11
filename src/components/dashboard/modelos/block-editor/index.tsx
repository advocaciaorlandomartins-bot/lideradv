"use client";

import dynamic from "next/dynamic";

export type { BlockEditorHandle } from "./block-editor";

const BlockEditor = dynamic(() => import("./block-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-lg border border-border bg-white font-body text-sm text-muted">
      Carregando editor…
    </div>
  ),
});

export default BlockEditor;
