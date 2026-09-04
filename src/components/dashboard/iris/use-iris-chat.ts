"use client";

import { useState, useCallback, useEffect } from "react";

export interface IrisAnexo {
  nome: string;
  mimeType: string;
}

export interface IrisToolTraceItem {
  name: string;
  label: string;
}

export interface IrisMessage {
  role: "user" | "assistant";
  content: string;
  anexos?: IrisAnexo[];
  toolTrace?: IrisToolTraceItem[];
}

export interface IrisConversaResumo {
  id: string;
  titulo: string;
  updatedAt: string;
}

interface PendingFile {
  file: File;
  id: string;
}

export const IRIS_MAX_ANEXOS = 3;
export const IRIS_MAX_ANEXO_BYTES = 6 * 1024 * 1024;
export const IRIS_MIME_SUPORTADOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
export const IRIS_ACCEPT_ATTR =
  "application/pdf,image/jpeg,image/png,image/webp";

export function useIrisChat(welcome: IrisMessage, storageKey: string) {
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [messages, setMessages] = useState<IrisMessage[]>([welcome]);
  const [loading, setLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [erroAnexo, setErroAnexo] = useState("");
  const [conversas, setConversas] = useState<IrisConversaResumo[]>([]);

  const loadConversation = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/iris/conversas/${id}`);
        if (!res.ok) return false;
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msgs: IrisMessage[] = (data.mensagens ?? []).map((m: any) => ({
          role: m.role,
          content: m.content,
          anexos: m.anexos ?? undefined,
          toolTrace: m.toolTrace ?? undefined,
        }));
        setMessages(msgs.length ? msgs : [welcome]);
        setConversaId(id);
        try {
          localStorage.setItem(storageKey, id);
        } catch {
          // ignore
        }
        return true;
      } catch {
        return false;
      }
    },
    [welcome, storageKey]
  );

  useEffect(() => {
    queueMicrotask(async () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(storageKey);
      } catch {
        // ignore
      }
      if (saved) {
        const ok = await loadConversation(saved);
        if (!ok) {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            // ignore
          }
        }
      }
    });
    // Só na montagem — loadConversation muda de identidade se welcome/storageKey
    // mudarem, mas a hidratação inicial só deve rodar uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    let erro = "";
    setPendingFiles((prev) => {
      const next = [...prev];
      for (const file of arr) {
        if (next.length >= IRIS_MAX_ANEXOS) {
          erro = `Máximo de ${IRIS_MAX_ANEXOS} arquivos por mensagem.`;
          break;
        }
        if (!IRIS_MIME_SUPORTADOS.has(file.type)) {
          erro = `Tipo não suportado: ${file.name}`;
          continue;
        }
        if (file.size > IRIS_MAX_ANEXO_BYTES) {
          erro = `Arquivo muito grande: ${file.name} (limite 6 MB)`;
          continue;
        }
        next.push({
          file,
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        });
      }
      return next;
    });
    setErroAnexo(erro);
  }, []);

  const removeFile = useCallback((id: string) => {
    setPendingFiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const startNewConversation = useCallback(() => {
    setConversaId(null);
    setMessages([welcome]);
    setPendingFiles([]);
    setErroAnexo("");
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [welcome, storageKey]);

  const refreshConversas = useCallback(async () => {
    try {
      const res = await fetch("/api/iris/conversas");
      if (!res.ok) return;
      const data = await res.json();
      setConversas(data.conversas ?? []);
    } catch {
      // ignore
    }
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/iris/conversas/${id}`, { method: "DELETE" });
      } catch {
        // ignore
      }
      setConversas((prev) => prev.filter((c) => c.id !== id));
      if (id === conversaId) startNewConversation();
    },
    [conversaId, startNewConversation]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const anexosMeta: IrisAnexo[] = pendingFiles.map((p) => ({
        nome: p.file.name,
        mimeType: p.file.type,
      }));
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: trimmed,
          anexos: anexosMeta.length ? anexosMeta : undefined,
        },
      ]);
      setLoading(true);
      setErroAnexo("");

      const fd = new FormData();
      fd.set("text", trimmed);
      if (conversaId) fd.set("conversaId", conversaId);
      for (const p of pendingFiles) fd.append("files", p.file);
      setPendingFiles([]);

      try {
        const res = await fetch("/api/iris/chat", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          // Conversa não existe mais (ex: excluída em outra aba) — limpa o
          // id local pra próxima mensagem criar uma conversa nova em vez de
          // ficar presa tentando falar com um id que não existe mais.
          if (res.status === 404) {
            setConversaId(null);
            try {
              localStorage.removeItem(storageKey);
            } catch {
              // ignore
            }
          }
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.error ?? "Erro ao consultar a Íris.",
            },
          ]);
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply ?? "Não obtive resposta. Tente novamente.",
            toolTrace: data.toolTrace?.length ? data.toolTrace : undefined,
          },
        ]);
        if (data.conversaId && data.conversaId !== conversaId) {
          setConversaId(data.conversaId);
          try {
            localStorage.setItem(storageKey, data.conversaId);
          } catch {
            // ignore
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Erro de conexão. Verifique sua internet e tente novamente.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, pendingFiles, conversaId, storageKey]
  );

  return {
    conversaId,
    messages,
    loading,
    pendingFiles,
    addFiles,
    removeFile,
    erroAnexo,
    sendMessage,
    conversas,
    refreshConversas,
    loadConversation,
    startNewConversation,
    deleteConversation,
  };
}
