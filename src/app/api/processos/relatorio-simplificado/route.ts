import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import { getAllProcessos } from "@/lib/processos-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { applyFundoTimbrado } from "@/lib/pdf-fundo";
import { RelatorioProcessosDoc } from "@/lib/pdf-relatorio-processos";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  em_andamento: "Em andamento",
  arquivado: "Arquivado",
  encerrado: "Encerrado",
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const idsRaw = Array.isArray(body?.processoIds) ? body.processoIds : [];
  const idsSolicitados = new Set(
    idsRaw.filter(
      (id: unknown): id is string => typeof id === "string" && UUID_RE.test(id)
    )
  );
  if (idsSolicitados.size === 0) {
    return NextResponse.json(
      { error: "Nenhum processo selecionado." },
      { status: 400 }
    );
  }

  // Mesmo escopo da própria listagem de Processos (getAllProcessos com o
  // mesmo responsavelId que a página usa) — ids fora desse conjunto
  // (adivinhados, ou de um processo que o usuário não pode ver) são só
  // ignorados no filtro abaixo, nunca geram erro que revele se existem.
  const verTodos = hasPermission(session, "processos_ver_todos", "ver");
  const colaboradorId = verTodos
    ? null
    : ((await getColaboradorIdForUser(session.id)) ??
      "00000000-0000-0000-0000-000000000000");

  const acessiveis = await getAllProcessos(verTodos ? null : colaboradorId);
  const selecionados = acessiveis.filter((p) => idsSolicitados.has(p.id));

  if (selecionados.length === 0) {
    return NextResponse.json(
      { error: "Nenhum processo encontrado." },
      { status: 404 }
    );
  }

  const escritorioConfig = await getEscritorioConfig();
  const dataGeracao = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const itens = selecionados.map((p) => ({
    clientName: p.client_name,
    numero: p.numero,
    area: p.area,
    statusLabel: STATUS_LABEL[p.status] ?? p.status,
    faseLabel: p.fase ?? "—",
    varaComarca: [p.vara, p.comarca].filter(Boolean).join(" / ") || "—",
  }));

  let buffer = await renderToBuffer(
    createElement(RelatorioProcessosDoc, {
      itens,
      config: escritorioConfig,
      dataGeracao,
    }) as ReactElement<DocumentProps>
  );

  if (
    escritorioConfig.fundo_timbrado_ativo &&
    escritorioConfig.fundo_timbrado
  ) {
    const withBg = await applyFundoTimbrado(
      new Uint8Array(buffer),
      escritorioConfig.fundo_timbrado
    );
    buffer = Buffer.from(withBg);
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio_processos_${new Date().toISOString().split("T")[0]}.pdf"`,
    },
  });
}
