"use client";

import { useRef } from "react";
import { UploadIcon, XMarkIcon, DocumentTextIcon } from "@/components/icons";
import { IRIS_ACCEPT_ATTR } from "./use-iris-chat";

interface PendingFile {
  file: File;
  id: string;
}

export function IrisAttachButton({
  onAdd,
  disabled,
}: {
  onAdd: (files: FileList) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Anexar PDF ou imagem"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-200 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
      >
        <UploadIcon className="h-4 w-4" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={IRIS_ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0)
            onAdd(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function IrisPendingChips({
  pendingFiles,
  onRemove,
  erro,
}: {
  pendingFiles: PendingFile[];
  onRemove: (id: string) => void;
  erro: string;
}) {
  if (pendingFiles.length === 0 && !erro) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5">
      {pendingFiles.map((p) => (
        <span
          key={p.id}
          className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 py-0.5 pl-2 pr-1 font-body text-[11px] text-violet-700"
        >
          <DocumentTextIcon className="h-3 w-3" />
          <span className="max-w-[8rem] truncate">{p.file.name}</span>
          <button
            type="button"
            onClick={() => onRemove(p.id)}
            className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-violet-200 cursor-pointer"
          >
            <XMarkIcon className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {erro && (
        <span className="font-body text-[11px] text-red-600">{erro}</span>
      )}
    </div>
  );
}
