import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import sql from "@/lib/db";
import { normalizarTelefoneBR, chaveTelefoneBR } from "@/lib/telefone-br";

export const dynamic = "force-dynamic";

function authOk(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const expected = process.env.PREVBOT_API_KEY;
  if (!expected || !token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * GET /api/integracoes/prevbot/cliente-por-telefone?telefone=...
 *
 * Diz ao PrevBot se um número de WhatsApp já é de um cliente CADASTRADO no
 * LiderAdv (direto, sem nunca ter passado pelo funil de lead do PrevBot) —
 * diferente da checagem de "cliente retornando" que o agente.ts já faz, que
 * só olha o histórico de leads do próprio PrevBot.
 *
 * Achado real (2026-11-16/17): cliente Wilson (cadastrado direto no LiderAdv,
 * nunca foi lead do PrevBot) respondeu "Bom dia" numa confirmação de perícia
 * que o próprio sistema mandou chamando-o pelo nome — e a Ana (bot de
 * qualificação de lead) tratou como desconhecido, perguntando "qual é o seu
 * nome?". Sem essa rota, o PrevBot não tinha como saber que aquele telefone
 * já era de alguém com caso ativo no escritório.
 *
 * Retorna uma LISTA porque um mesmo telefone pode ser de mais de um cliente
 * ao mesmo tempo — achado real (2026-11-17): a mesma mãe (responsável legal)
 * tem dois filhos menores cadastrados como clientes diferentes, cada um com
 * seu próprio caso, usando o telefone dela nos dois cadastros. Devolver só
 * "o primeiro que achar" faria o PrevBot assumir o caso errado.
 */
export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const telefoneParam = req.nextUrl.searchParams.get("telefone") ?? "";
  const tel = normalizarTelefoneBR(telefoneParam);
  if (!tel) {
    return NextResponse.json(
      { error: "telefone é obrigatório." },
      { status: 400 }
    );
  }
  const chaveAlvo = chaveTelefoneBR(tel);

  // Só 31 clientes cadastrados hoje — busca tudo e compara em JS, mesmo
  // padrão já usado em /colaboradores e /usuario pra essa ambiguidade de
  // telefone BR (não dá pra resolver isso só com LIKE/regexp no SQL). Compara
  // tanto o telefone do próprio cliente quanto o do responsável legal — num
  // cadastro de menor, o número que recebe mensagem pode estar só num dos
  // dois campos dependendo de como foi cadastrado.
  const clientes = await sql`
    SELECT id::text, name, phone, menor_incapaz, responsavel_nome, responsavel_telefone
    FROM clients
    WHERE deleted_at IS NULL
      AND (
        (phone IS NOT NULL AND phone <> '' AND phone <> 'PENDENTE')
        OR (responsavel_telefone IS NOT NULL AND responsavel_telefone <> '')
      )
  `;
  const encontrados = clientes.filter((c) => {
    const chavePropria = c.phone
      ? chaveTelefoneBR(normalizarTelefoneBR(String(c.phone)))
      : null;
    const chaveResp = c.responsavel_telefone
      ? chaveTelefoneBR(normalizarTelefoneBR(String(c.responsavel_telefone)))
      : null;
    return chavePropria === chaveAlvo || chaveResp === chaveAlvo;
  });

  if (encontrados.length === 0) {
    return NextResponse.json({ encontrado: false });
  }

  const clientesComProcessos = await Promise.all(
    encontrados.map(async (cliente) => {
      const processos = await sql`
        SELECT numero, tipo_acao
        FROM processos
        WHERE client_id = ${cliente.id}::uuid
          AND deleted_at IS NULL
          AND status NOT IN ('arquivado', 'encerrado')
        ORDER BY created_at DESC
      `;
      return {
        clienteId: String(cliente.id),
        nome: String(cliente.name),
        menorIncapaz: Boolean(cliente.menor_incapaz),
        responsavelNome: cliente.responsavel_nome
          ? String(cliente.responsavel_nome)
          : null,
        processosAtivos: processos.map((p) => ({
          numero: String(p.numero),
          tipoAcao: p.tipo_acao ? String(p.tipo_acao) : null,
        })),
      };
    })
  );

  return NextResponse.json({
    encontrado: true,
    clientes: clientesComProcessos,
  });
}
