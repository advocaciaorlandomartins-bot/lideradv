"use client";

import { useState, useCallback, useEffect } from "react";
import { upload } from "@vercel/blob/client";

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

export interface PendingFile {
  id: string;
  nome: string;
  mimeType: string;
  status: "enviando" | "pronto" | "erro";
  url?: string;
  erro?: string;
}

export const IRIS_MAX_ANEXOS = 3;
export const IRIS_MAX_ANEXO_BYTES = 25 * 1024 * 1024;
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

  // Sobe direto do navegador pro Vercel Blob (upload() do @vercel/blob/client)
  // em vez de mandar os bytes dentro do corpo de /api/iris/chat — Serverless
  // Functions da Vercel têm um limite fixo de 4,5 MB de corpo de requisição,
  // bem abaixo do tamanho normal de um PDF escaneado de verdade (uma
  // procuração + RG + laudo já passa disso). Só a URL do Blob (texto
  // pequeno) chega na rota do chat.
  const uploadArquivo = useCallback(async (id: string, file: File) => {
    try {
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/iris/upload-anexo",
      });
      setPendingFiles((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "pronto", url: blob.url } : p
        )
      );
    } catch {
      setPendingFiles((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: "erro", erro: "Falha ao enviar o arquivo." }
            : p
        )
      );
    }
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      let erro = "";
      setPendingFiles((prev) => {
        const novos: PendingFile[] = [];
        let total = prev.length;
        for (const file of arr) {
          if (total >= IRIS_MAX_ANEXOS) {
            erro = `Máximo de ${IRIS_MAX_ANEXOS} arquivos por mensagem.`;
            break;
          }
          if (!IRIS_MIME_SUPORTADOS.has(file.type)) {
            erro = `Tipo não suportado: ${file.name}`;
            continue;
          }
          if (file.size > IRIS_MAX_ANEXO_BYTES) {
            erro = `Arquivo muito grande: ${file.name} (limite ${Math.round(IRIS_MAX_ANEXO_BYTES / 1024 / 1024)} MB)`;
            continue;
          }
          const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
          novos.push({
            id,
            nome: file.name,
            mimeType: file.type,
            status: "enviando",
          });
          total += 1;
          uploadArquivo(id, file);
        }
        return [...prev, ...novos];
      });
      setErroAnexo(erro);
    },
    [uploadArquivo]
  );

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
      if (pendingFiles.some((p) => p.status === "enviando")) return;

      const prontos = pendingFiles.filter(
        (p): p is PendingFile & { url: string } =>
          p.status === "pronto" && !!p.url
      );
      const anexosMeta: IrisAnexo[] = prontos.map((p) => ({
        nome: p.nome,
        mimeType: p.mimeType,
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
      setPendingFiles([]);

      try {
        const res = await fetch("/api/iris/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            conversaId,
            attachments: prontos.map((p) => ({
              url: p.url,
              nome: p.nome,
              mimeType: p.mimeType,
            })),
          }),
        });
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
