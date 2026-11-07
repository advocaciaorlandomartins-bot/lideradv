"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarControleComResponsavelDoProcessoAction } from "@/lib/controles-actions";
import { CalendarIcon, SpinnerIcon, CheckIcon } from "@/components/icons";
import { brParaIso } from "@/lib/data-br";

interface Props {
  pubId: number;
  clienteId: string | null;
  clienteNome: string | null;
  processoId: string | null;
  descricaoSugerida: string;
  // Audiência tem prioridade (data concreta extraída do texto) sobre o
  // prazo final calculado (que depende de prazo_dias estimado pela IA).
  audienciaBr: string | null;
  prazoFinalBr: string | null;
  jaExiste: { descricao: string; dataEvento: string } | null;
}

export default function CriarPrazoResumoButton({
  clienteId,
  clienteNome,
  processoId,
  descricaoSugerida,
  audienciaBr,
  prazoFinalBr,
  jaExiste,
}: Props) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [criado, setCriado] = useState(false);

  const tipo: "audiencias" | "prazos" | null = audienciaBr
    ? "audiencias"
    : prazoFinalBr
      ? "prazos"
      : null;
  const dataEvento = tipo === "audiencias" ? audienciaBr : prazoFinalBr;
  const dataIso = brParaIso(dataEvento);

  if (jaExiste) {
    return (
      <p className="flex items-center gap-1.5 font-body text-xs font-semibold text-emerald-700">
        <CheckIcon className="h-3.5 w-3.5" />
        Prazo já criado em Controles (
        {jaExiste.dataEvento.split("-").reverse().join("/")})
      </p>
    );
  }

  if (criado) {
    return (
      <p className="flex items-center gap-1.5 font-body text-xs font-semibold text-emerald-700">
        <CheckIcon className="h-3.5 w-3.5" />
        {tipo === "audiencias" ? "Audiência criada" : "Prazo criado"} em
        Controles — o responsável do processo foi avisado.
      </p>
    );
  }

  if (!tipo || !dataIso) return null;

  // Sem processo/cliente vinculado à publicação (CNJ não identificado, ou
  // associação manual ainda não feita): não dá pra criar automaticamente —
  // cai pro formulário manual pré-preenchido, que já existia.
  if (!clienteId || !processoId) {
    const params = new URLSearchParams({
      tipo,
      descricao: descricaoSugerida,
      data_evento: dataIso,
    });
    return (
      <Link
        href={`/dashboard/controles/novo?${params.toString()}`}
        className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 font-body text-xs font-semibold text-primary hover:bg-primary/10"
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        Criar {tipo === "audiencias" ? "audiência" : "prazo"} (processo não
        identificado — preencher manualmente)
      </Link>
    );
  }

  async function criar() {
    setCarregando(true);
    setErro("");
    const res = await criarControleComResponsavelDoProcessoAction({
      clienteId: clienteId!,
      clienteNome: clienteNome ?? "",
      processoId,
      tipo: tipo!,
      descricao: descricaoSugerida,
      dataEvento: dataIso!,
    });
    setCarregando(false);
    if (res?.error) {
      setErro(res.error);
    } else {
      setCriado(true);
      router.refresh();
    }
  }

  return (
    <div>
      <button
        onClick={criar}
        disabled={carregando}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-body text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {carregando ? (
          <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CalendarIcon className="h-3.5 w-3.5" />
        )}
        {carregando
          ? "Criando…"
          : `Criar ${tipo === "audiencias" ? "audiência" : "prazo"} (${dataEvento}) em Controles`}
      </button>
      {erro && <p className="mt-1 font-body text-xs text-red-600">{erro}</p>}
    </div>
  );
}
