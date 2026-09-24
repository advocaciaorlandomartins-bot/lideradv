import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import sql from "@/lib/db";
import { getClientFull } from "@/lib/clients-db";
import { getModelosAtivos } from "@/lib/modelos-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { getAdvogadosParaDocumento } from "@/lib/colaboradores-db";
import { buildModeloVars, replaceVars } from "@/lib/modelo-vars";
import {
  blocksToHtml,
  textToHtml,
  substituteVariablesInBlocks,
} from "@/lib/modelo-blocks";
import {
  criarEnvelope,
  atualizarAssinanteTramitaSign,
} from "@/lib/assinaturas-db";
import {
  tramitaSignAtivo,
  tramitaCriarCliente,
  tramitaEnviarDocumento,
  tramitaObterUserId,
} from "@/lib/tramitasign";

export const dynamic = "force-dynamic";

// ── Auth ──────────────────────────────────────────────────────────────────────

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

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

async function resolverAdminLogin(): Promise<string> {
  const rows = await sql`
    SELECT login FROM usuarios WHERE categoria = 'admin' AND ativo = true ORDER BY id LIMIT 1
  `;
  return rows.length ? String(rows[0].login) : "sistema";
}

// ── POST /api/integracoes/prevbot/contrato ───────────────────────────────────
//
// Gera o contrato de honorários (com o TramitaSign fazendo a assinatura
// eletrônica com selfie) pra um lead do PrevBot — reaproveita o mesmo sistema
// de Assinaturas (envelopes) já usado manualmente pelo escritório, só que
// disparado automaticamente quando o cliente confirma que quer fechar pelo
// WhatsApp. O PrevBot manda os dados cadastrais já coletados na conversa;
// esta rota resolve/atualiza o cliente, escolhe o modelo certo (com ou sem
// responsável legal) e devolve o link de assinatura pronto.
export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  const cpfRaw = String(body.cpf ?? "").replace(/\D/g, "");
  const telefone = normalizarTelefone(String(body.telefone ?? ""));
  if (!nome || !cpfRaw || !telefone) {
    return NextResponse.json(
      { ok: false, error: "Campos obrigatórios: nome, cpf, telefone." },
      { status: 422 }
    );
  }

  if (!tramitaSignAtivo()) {
    return NextResponse.json(
      { ok: false, error: "TramitaSign não configurado no LiderAdv." },
      { status: 503 }
    );
  }

  const email = (String(body.email ?? "").trim() || null) as string | null;
  const prevbotLeadId = (String(body.prevbot_lead_id ?? "").trim() || null) as
    | string
    | null;
  const camposOpcionais = {
    rg: String(body.rg ?? "").trim() || null,
    rg_orgao: String(body.rg_orgao ?? "").trim() || null,
    estado_civil: String(body.estado_civil ?? "").trim() || null,
    profissao: String(body.profissao ?? "").trim() || null,
    cep: String(body.cep ?? "").trim() || null,
    endereco: String(body.endereco ?? "").trim() || null,
    numero: String(body.numero ?? "").trim() || null,
    bairro: String(body.bairro ?? "").trim() || null,
    cidade: String(body.cidade ?? "").trim() || null,
    estado: String(body.estado ?? "").trim() || null,
  };

  try {
    // ── 1. Resolve ou cria o cliente pelo CPF ──
    const existente = await sql`
      SELECT id::text FROM clients WHERE regexp_replace(doc, '\D', '', 'g') = ${cpfRaw} LIMIT 1
    `;

    let clienteId: string;
    if (existente.length > 0) {
      clienteId = String(existente[0].id);
      // Atualiza só o que veio preenchido, sem apagar dado já cadastrado.
      await sql`
        UPDATE clients SET
          name        = ${nome},
          phone       = COALESCE(${telefone}, phone),
          email       = COALESCE(${email}, email),
          rg          = COALESCE(${camposOpcionais.rg}, rg),
          rg_orgao    = COALESCE(${camposOpcionais.rg_orgao}, rg_orgao),
          estado_civil= COALESCE(${camposOpcionais.estado_civil}, estado_civil),
          profissao   = COALESCE(${camposOpcionais.profissao}, profissao),
          cep         = COALESCE(${camposOpcionais.cep}, cep),
          street      = COALESCE(${camposOpcionais.endereco}, street),
          addr_number = COALESCE(${camposOpcionais.numero}, addr_number),
          neighborhood= COALESCE(${camposOpcionais.bairro}, neighborhood),
          city        = COALESCE(${camposOpcionais.cidade}, city),
          state       = COALESCE(${camposOpcionais.estado}, state)
        WHERE id = ${clienteId}::uuid
      `;
    } else {
      const rows = await sql`
        INSERT INTO clients (
          type, name, doc, email, phone,
          rg, rg_orgao, estado_civil, profissao,
          cep, street, addr_number, neighborhood, city, state,
          status
        ) VALUES (
          'PF', ${nome}, ${cpfRaw}, ${email ?? ""}, ${telefone},
          ${camposOpcionais.rg}, ${camposOpcionais.rg_orgao}, ${camposOpcionais.estado_civil}, ${camposOpcionais.profissao},
          ${camposOpcionais.cep}, ${camposOpcionais.endereco}, ${camposOpcionais.numero}, ${camposOpcionais.bairro}, ${camposOpcionais.cidade}, ${camposOpcionais.estado},
          'ativo'
        )
        RETURNING id::text
      `;
      clienteId = String(rows[0].id);
    }

    const client = await getClientFull(clienteId);
    if (!client) {
      return NextResponse.json(
        { ok: false, error: "Falha ao resolver cadastro do cliente." },
        { status: 500 }
      );
    }

    // ── 2. Escolhe o modelo certo (com/sem responsável legal) ──
    const modelos = await getModelosAtivos();
    const requerResponsavel = client.menor_incapaz;
    const modelo = modelos.find(
      (m) => m.requer_responsavel_legal === requerResponsavel
    );
    if (!modelo) {
      return NextResponse.json(
        {
          ok: false,
          error: `Nenhum modelo de contrato ativo configurado (requer_responsavel_legal=${requerResponsavel}). Cadastre em Documentos → Modelos.`,
        },
        { status: 422 }
      );
    }

    // ── 3. Monta o HTML já preenchido ──
    const escritorioConfig = await getEscritorioConfig();
    const dataHoje = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });
    const advogados = await getAdvogadosParaDocumento().catch(() => []);
    const vars = buildModeloVars(client, escritorioConfig, dataHoje, advogados);
    const html = modelo.conteudo_blocks
      ? blocksToHtml(substituteVariablesInBlocks(modelo.conteudo_blocks, vars))
      : textToHtml(replaceVars(modelo.conteudo, vars));

    // ── 4. Cria o envelope (registro interno) ──
    const criadoPor = await resolverAdminLogin();
    const { assinantes } = await criarEnvelope({
      nome: `${modelo.titulo} — ${nome}`,
      prazo: null,
      status: "aguardando",
      notifAssinantes: false,
      notifCriador: false,
      notifEscritorio: false,
      criadoPor,
      clienteId,
      assinantes: [
        {
          tipo: "cliente",
          nome,
          email: email ?? "",
          papel: "assinante",
          valEmail: false,
          valSelfie: true,
          valDocumento: true,
          ordem: 1,
        },
      ],
      documentos: [
        {
          modeloId: modelo.id,
          nome: modelo.titulo,
          htmlContent: html,
          ordem: 1,
        },
      ],
    });
    const assinante = assinantes[0];

    // ── 5. Cria o documento de assinatura no TramitaSign ──
    const userId = await tramitaObterUserId();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível autenticar no TramitaSign." },
        { status: 502 }
      );
    }
    const tsCliente = await tramitaCriarCliente({
      nome,
      email,
      telefone,
      cpf: cpfRaw,
    });
    if (!tsCliente?.id) {
      return NextResponse.json(
        { ok: false, error: "Falha ao criar cliente no TramitaSign." },
        { status: 502 }
      );
    }
    const doc = await tramitaEnviarDocumento({
      clienteId: tsCliente.id,
      userId,
      titulo: modelo.titulo,
      htmlContent: html,
      // O PrevBot manda o link pelo próprio WhatsApp — não pede notificação
      // duplicada do TramitaSign por e-mail/WhatsApp aqui.
      email: null,
      telefone: null,
      requireSelfie: true,
      requireDocument: true,
    });
    if (!doc?.link || !doc?.id) {
      return NextResponse.json(
        { ok: false, error: "TramitaSign não retornou link de assinatura." },
        { status: 502 }
      );
    }

    await atualizarAssinanteTramitaSign(assinante.id, {
      documentoId: doc.id,
      link: doc.link,
    });

    // ── 6. Sincroniza com crm_leads — é isso que faz o webhook do TramitaSign
    // (quando o cliente assinar) reconhecer que é um lead do PrevBot e avisar
    // de volta via PREVBOT_CALLBACK_URL.
    const existenteLead = telefone
      ? await sql`SELECT id::text FROM crm_leads WHERE telefone = ${telefone} AND origem = 'prevbot' LIMIT 1`
      : [];
    if (existenteLead.length > 0) {
      await sql`
        UPDATE crm_leads SET
          contrato_id = ${doc.id},
          contrato_status = 'aguardando_assinatura',
          prevbot_lead_id = COALESCE(${prevbotLeadId}, prevbot_lead_id),
          client_id = COALESCE(client_id, ${clienteId}::uuid),
          updated_at = now()
        WHERE id = ${existenteLead[0].id}::uuid
      `;
    } else {
      await sql`
        INSERT INTO crm_leads
          (nome, email, telefone, tipo, estagio, origem, prevbot_lead_id, contrato_id, contrato_status, client_id)
        VALUES
          (${nome}, ${email}, ${telefone}, 'PF', 'novo_contato', 'prevbot', ${prevbotLeadId}, ${doc.id}, 'aguardando_assinatura', ${clienteId}::uuid)
      `;
    }

    return NextResponse.json({
      ok: true,
      link: doc.link,
      documento_id: doc.id,
      client_id: clienteId,
      modelo: modelo.titulo,
    });
  } catch (err) {
    console.error(
      "[prevbot/contrato]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { ok: false, error: "Erro interno ao gerar contrato." },
      { status: 500 }
    );
  }
}
