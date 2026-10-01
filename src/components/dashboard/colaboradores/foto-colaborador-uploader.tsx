"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { atualizarFotoColaboradorAction } from "@/lib/colaborador-actions";
import { UploadIcon, SpinnerIcon } from "@/components/icons";

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;

function lerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload de foto de perfil do colaborador — avatar grande clicável, mesmo
 * padrão visual do resto do sistema (iniciais coloridas quando não há
 * foto). Usado tanto pelo admin editando qualquer colaborador quanto pelo
 * próprio em "Meus Dados" (permissão checada na Server Action via
 * podeAcessarColaborador).
 */
export function FotoColaboradorUploader({
  colaboradorId,
  nome,
  fotoUrlInicial,
}: {
  colaboradorId: string;
  nome: string;
  fotoUrlInicial: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fotoUrl, setFotoUrl] = useState(fotoUrlInicial);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErro(null);

    if (!TIPOS_ACEITOS.includes(file.type)) {
      setErro("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErro("Imagem muito grande (máximo 3MB).");
      return;
    }

    setEnviando(true);
    try {
      const dataUrl = await lerComoDataUrl(file);
      const resultado = await atualizarFotoColaboradorAction(
        colaboradorId,
        dataUrl
      );
      if ("error" in resultado) {
        setErro(resultado.error);
      } else {
        // resultado.url é a URL crua (privada) do Blob, só pra confirmar
        // que salvou — quem exibe é sempre a rota proxy (nunca a URL
        // crua, que exige token e nenhum <img> consegue buscar sozinho).
        // ?t= evita mostrar a foto antiga cacheada (Cache-Control de 5min
        // na rota) logo depois de trocar.
        setFotoUrl(`/api/colaboradores/${colaboradorId}/foto?t=${Date.now()}`);
      }
    } catch {
      setErro("Erro ao enviar a foto. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        className="group relative cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait"
        title="Trocar foto"
      >
        <Avatar
          nome={nome}
          fotoUrl={fotoUrl}
          size="h-20 w-20"
          className="text-xl ring-2 ring-white shadow-sm"
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
          {enviando ? (
            <SpinnerIcon className="h-5 w-5 animate-spin" />
          ) : (
            <UploadIcon className="h-5 w-5" />
          )}
        </span>
      </button>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="cursor-pointer font-body text-sm font-semibold text-primary hover:underline disabled:cursor-wait disabled:opacity-60"
        >
          {fotoUrl ? "Trocar foto" : "Adicionar foto"}
        </button>
        <p className="font-body text-xs text-muted">
          JPG, PNG ou WEBP, até 3MB
        </p>
        {erro && (
          <p className="mt-1 font-body text-xs font-semibold text-red-600">
            {erro}
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
}
