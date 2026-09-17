import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import {
  getMeuFinanceiroInitial,
  criarLancamentoPessoal,
} from "@/lib/meu-financeiro-db";

const TIPOS_VALIDOS = ["receita", "despesa"] as const;
const STATUS_VALIDOS = ["recebido", "a_receber", "pago", "pendente"] as const;

export async function GET() {
  const session = await getSession();
  // hasPermission fecha o buraco de quem tem meu_financeiro removido
  // explicitamente (ex: categoria "Colaborador(a)", que não tem esse módulo
  // por padrão) mas ainda conseguia gerenciar os próprios lançamentos
  // chamando a rota direto — os dados já eram sempre escopados por
  // usuario_id, então não era um IDOR, só o gate de permissão faltando.
  if (!session || !hasPermission(session, "meu_financeiro", "ver"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await getMeuFinanceiroInitial(session.id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[meu-financeiro/lancamentos GET]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  // "ver" (não "criar") de propósito: por padrão Advogado(a)/Estagiário(a) só
  // têm "ver" neste módulo e já usam esta rota pra lançar os próprios gastos
  // — exigir "criar" quebraria o uso normal deles. O que importa fechar aqui
  // é quem não tem NENHUM acesso ao módulo (ex: Colaborador(a), que tem
  // meu_financeiro: NONE por padrão).
  if (!session || !hasPermission(session, "meu_financeiro", "ver"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      tipo,
      categoria,
      descricao,
      valor,
      data,
      status,
      recorrente,
      periodicidade,
    } = body;

    if (!tipo || !categoria || !descricao || !valor || !data || !status) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes" },
        { status: 400 }
      );
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json(
        { error: `Campo 'tipo' inválido. Use: ${TIPOS_VALIDOS.join(", ")}` },
        { status: 400 }
      );
    }
    if (!STATUS_VALIDOS.includes(status)) {
      return NextResponse.json(
        { error: `Status inválido. Use: ${STATUS_VALIDOS.join(", ")}` },
        { status: 400 }
      );
    }

    const parsed = parseFloat(String(valor));
    if (isNaN(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const novo = await criarLancamentoPessoal(session.id, {
      tipo,
      categoria: String(categoria).slice(0, 100),
      descricao: String(descricao).slice(0, 500),
      valor: parsed,
      data: String(data).slice(0, 10),
      status,
      recorrente: Boolean(recorrente),
      periodicidade: recorrente ? (periodicidade ?? null) : null,
    });

    return NextResponse.json(novo, { status: 201 });
  } catch (err) {
    console.error("[meu-financeiro/lancamentos POST]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
