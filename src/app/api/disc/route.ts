import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Perfis DISC e lógica de análise
function analisarDISC(pa: number, pb: number, pc: number, pd: number) {
  const scores = { A: pa, B: pb, C: pc, D: pd };
  const dominant = (Object.entries(scores) as [string, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  const perfilMap: Record<
    string,
    {
      nome: string;
      funcao: string;
      fortes: string;
      atencao: string;
      pergunta: string;
    }
  > = {
    A: {
      nome: "Executor/Dominante",
      funcao: "SDR / Vendas / Audiências",
      fortes:
        "Foco em resultados, assertividade, facilidade para fechar contratos e se destacar em audiências. Não teme o 'não' e transforma objeções em oportunidades.",
      atencao:
        "Pode ser impaciente com processos detalhados (peticionamento). Pode conflitar com colegas mais lentos. Não ideal para backoffice ou cálculos.",
      pergunta:
        "Me conte sobre uma vez que você precisou convencer alguém que relutava em aceitar sua ideia. O que fez e qual foi o resultado?",
    },
    B: {
      nome: "Comunicador/Influente",
      funcao: "Atendimento ao Cliente / Captação",
      fortes:
        "Empatia natural, facilidade de criar vínculo com o cliente, carisma e otimismo. Excelente para recepcionar clientes vulneráveis (BPC, rural).",
      atencao:
        "Pode ser desorganizado e prometer mais do que o escritório pode entregar. Precisa de supervisão em prazos e documentação formal.",
      pergunta:
        "Como você lida quando um cliente está muito ansioso ou bravo? Me dê um exemplo concreto.",
    },
    C: {
      nome: "Planejador/Estável",
      funcao: "Operacional / Backoffice",
      fortes:
        "Organização, constância, capacidade de gerenciar múltiplos processos sem perder o fio. Ótimo para controle de prazos e andamentos.",
      atencao:
        "Pode ter dificuldade com mudanças rápidas de prioridade. Em vendas, pode perder o timing do fechamento por ser cauteloso demais.",
      pergunta:
        "Como você organiza sua semana quando tem muitas tarefas paralelas com prazos diferentes? Qual ferramenta ou método usa?",
    },
    D: {
      nome: "Analista/Conforme",
      funcao: "Cálculos / Peticionamento Técnico",
      fortes:
        "Precisão técnica, atenção a detalhes, disciplina para pesquisa jurisprudencial e elaboração de petições complexas. Avesso a erros.",
      atencao:
        "Em contato direto com clientes pode parecer frio ou distante. Não se adapta bem a metas agressivas de vendas ou trabalho sob pressão social.",
      pergunta:
        "Me mostre um trabalho técnico (petição, cálculo, análise de CNIS) que você fez e que considera seu melhor nível. O que você fez diferente dos outros?",
    },
  };

  const perfil = perfilMap[dominant];
  const scoreMax = Math.max(pa, pb, pc, pd);
  const scorePct = Math.round((scoreMax / (pa + pb + pc + pd || 1)) * 100);

  let recomendacao = "APROVADO";
  if (scorePct < 35) recomendacao = "PERFIL MISTO — AVALIAR COM CAUTELA";
  else if (scorePct >= 50) recomendacao = "APROVADO — PERFIL FORTE E DEFINIDO";

  return {
    perfil_dominante: `${dominant} — ${perfil.nome}`,
    funcao_sugerida: perfil.funcao,
    pontos_fortes: perfil.fortes,
    pontos_atencao: perfil.atencao,
    recomendacao,
    pergunta_entrevista: perfil.pergunta,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const testes = await sql`
    SELECT id, nome_candidato, cargo_vaga, perfil_dominante, funcao_sugerida,
           recomendacao, pontuacao_a, pontuacao_b, pontuacao_c, pontuacao_d, created_at
    FROM testes_comportamentais
    ORDER BY created_at DESC
    LIMIT 100
  `;

  return NextResponse.json({ testes });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const { nome_candidato, cargo_vaga, respostas } = body as {
    nome_candidato?: string;
    cargo_vaga?: string;
    respostas?: { bloco: number; a: number; b: number; c: number; d: number }[];
  };

  if (!nome_candidato?.trim()) {
    return NextResponse.json(
      { error: "nome_candidato é obrigatório." },
      { status: 400 }
    );
  }

  if (!Array.isArray(respostas) || respostas.length === 0) {
    return NextResponse.json(
      { error: "respostas é obrigatório e deve ser um array." },
      { status: 400 }
    );
  }

  // Validar cada bloco: notas 1–4, sem repetição
  for (const bloco of respostas) {
    const vals = [bloco.a, bloco.b, bloco.c, bloco.d];
    if (vals.some((v) => typeof v !== "number" || v < 1 || v > 4)) {
      return NextResponse.json(
        { error: "Cada nota deve ser um número entre 1 e 4." },
        { status: 400 }
      );
    }
    if (new Set(vals).size !== 4) {
      return NextResponse.json(
        { error: `Bloco ${bloco.bloco}: notas não podem se repetir.` },
        { status: 400 }
      );
    }
  }

  // Somar pontuações
  const pa = respostas.reduce((s, r) => s + r.a, 0);
  const pb = respostas.reduce((s, r) => s + r.b, 0);
  const pc = respostas.reduce((s, r) => s + r.c, 0);
  const pd = respostas.reduce((s, r) => s + r.d, 0);

  const analise = analisarDISC(pa, pb, pc, pd);

  const [teste] = await sql`
    INSERT INTO testes_comportamentais (
      nome_candidato, cargo_vaga, pontuacao_a, pontuacao_b, pontuacao_c, pontuacao_d,
      perfil_dominante, funcao_sugerida, pontos_fortes, pontos_atencao,
      recomendacao, pergunta_entrevista, respostas, created_by
    ) VALUES (
      ${nome_candidato.trim()},
      ${cargo_vaga?.trim() ?? null},
      ${pa}, ${pb}, ${pc}, ${pd},
      ${analise.perfil_dominante},
      ${analise.funcao_sugerida},
      ${analise.pontos_fortes},
      ${analise.pontos_atencao},
      ${analise.recomendacao},
      ${analise.pergunta_entrevista},
      ${JSON.stringify(respostas)},
      ${session.id}
    )
    RETURNING *
  `;

  return NextResponse.json({ teste }, { status: 201 });
}
