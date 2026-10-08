/**
 * POST /api/ia/peticao
 * Gera petição jurídica com streaming usando skill especializada.
 * Body: { skill, tipoPeticao, clienteId?, processoId?, instrucaoExtra? }
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { podeAcessarEntidade } from "@/lib/acesso";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { gerarPeticaoStream, SKILLS, type SkillId } from "@/lib/ai-juridico";
import { getClientFull } from "@/lib/clients-db";
import { getProcessoById } from "@/lib/processos-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { gerarContextoPeticao } from "@/lib/cerebroJuridico";
import {
  getAtualizacoesLegaisRecentes,
  formatarAtualizacoesLegaisTexto,
} from "@/lib/atualizacoes-legais-db";
import { listarDispositivosPorNorma } from "@/lib/base-legal-db";
import { codigoDoTipo } from "@/lib/checklist-documentos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (await iaRateLimitExcedido(session.login)) {
    return NextResponse.json(
      {
        error:
          "Limite de requisições de IA excedido. Tente novamente em 1 hora.",
      },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Chave de IA não configurada." },
      { status: 503 }
    );
  }

  let body: {
    skill?: string;
    tipoPeticao?: string;
    clienteId?: string;
    processoId?: string;
    instrucaoExtra?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { skill, tipoPeticao, clienteId, processoId, instrucaoExtra } = body;

  if (!skill || !tipoPeticao) {
    return NextResponse.json(
      { error: "skill e tipoPeticao são obrigatórios." },
      { status: 400 }
    );
  }

  if (!SKILLS[skill as SkillId]) {
    return NextResponse.json({ error: "Skill inválida." }, { status: 400 });
  }

  if (
    processoId &&
    !(await podeAcessarEntidade(session, "processo", processoId))
  ) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (
    clienteId &&
    !(await podeAcessarEntidade(session, "cliente", clienteId))
  ) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const [escritorio, cliente, processo, cerebroCtx, atualizacoesLegais] =
    await Promise.all([
      getEscritorioConfig(),
      clienteId ? getClientFull(clienteId).catch(() => null) : null,
      processoId ? getProcessoById(processoId).catch(() => null) : null,
      processoId
        ? gerarContextoPeticao(processoId, tipoPeticao).catch(() => "")
        : Promise.resolve(""),
      getAtualizacoesLegaisRecentes().catch(() => []),
    ]);

  // Mudanças normativas recentes (INSS/Previdência) que a IA de treino não
  // teria como conhecer — mesmo cron diário já usado na tela "Leis & DOU",
  // agora também informando o Dr. Lex antes de redigir.
  const atualizacoesTexto =
    atualizacoesLegais.length > 0
      ? `=== MUDANÇAS LEGAIS/NORMATIVAS RECENTES (últimos 6 meses) ===\n${formatarAtualizacoesLegaisTexto(atualizacoesLegais)}\n\nUse essas informações apenas se forem relevantes pro caso — não force a citação se não se aplicar.`
      : "";

  // Base Legal Viva (migração 009) — injeta o texto oficial verificado
  // (hash + redação dada por cada lei alteradora) quando o benefício é
  // BPC/LOAS, pra Gerar Petição citar o dispositivo real em vez de depender
  // da memória do modelo. Cobertura ainda só do art. 20 da LOAS — outros
  // benefícios continuam sem essa camada até a base ser ampliada.
  const codigoBeneficio = processo?.tipo_acao
    ? codigoDoTipo(processo.tipo_acao)
    : null;
  const ehBpc =
    codigoBeneficio === "B80" ||
    codigoBeneficio === "B87" ||
    codigoBeneficio === "B88";
  const baseLegalViva = ehBpc
    ? await listarDispositivosPorNorma("Lei 8.742/1993").catch(() => [])
    : [];
  const baseLegalVivaTexto =
    baseLegalViva.length > 0
      ? `=== BASE LEGAL APLICÁVEL (VERIFICADA — Lei 8.742/1993, LOAS) ===\n${baseLegalViva
          .map(
            (d) =>
              `${d.caminho}${d.revogado ? " [REVOGADO]" : ""}: "${d.texto}"${
                d.redacaoDadaPor ? ` (${d.redacaoDadaPor})` : ""
              }`
          )
          .join(
            "\n"
          )}\n\nEsses são os dispositivos EXATOS, coletados de planalto.gov.br — cite SOMENTE estes números de artigo/parágrafo quando se referir à LOAS. Não cite nenhum outro parágrafo da LOAS além dos listados acima.`
      : "";

  const instrucaoFinal = [
    cerebroCtx,
    baseLegalVivaTexto,
    atualizacoesTexto,
    instrucaoExtra,
  ]
    .filter(Boolean)
    .join("\n\n");

  const stream = await gerarPeticaoStream({
    skill: skill as SkillId,
    tipoPeticao,
    contexto: {
      escritorio,
      cliente: cliente ?? undefined,
      processo: processo ?? undefined,
      instrucaoExtra: instrucaoFinal || undefined,
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
