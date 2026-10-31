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
import { criarEnvelope, getEnvelopeById } from "@/lib/assinaturas-db";
import { tramitaSignAtivo } from "@/lib/tramitasign";
import { enviarEnvelopeParaTramitaSign } from "@/lib/assinaturas-actions";

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
  // Slug do PrevBot (bpc_loas, salario_maternidade...) — decide quais
  // documentos ADICIONAIS (Termo BPC-LOAS, Declaração de Renúncia Bolsa
  // Família, Termo de Representação, Formulário LOAS) entram automaticamente
  // no mesmo envelope do contrato de honorários. Sem isso (omitido/vazio),
  // comportamento igual a antes: só o contrato.
  const beneficio = String(body.beneficio ?? "").trim() || null;
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
  // Dados do responsável legal — sem isso o cliente menor/incapaz nunca
  // chegava marcado como tal quando o próprio PrevBot cria o cadastro
  // (achado em 2026-10-31: o signatário do envelope ficava sempre sendo o
  // beneficiário, nunca o responsável, mesmo em caso de BPC/LOAS com
  // responsável familiar). `menor_incapaz` só é alterado quando o PrevBot
  // manda o campo explicitamente (null aqui = não mexe no que já tá
  // cadastrado) — não dá pra inferir isso a partir da presença de
  // responsavel_nome, porque um adulto capaz também pode ter um "contato de
  // apoio" cadastrado sem que o caso seja de representação legal.
  const menorIncapazBody =
    typeof body.menor_incapaz === "boolean" ? body.menor_incapaz : null;
  const camposResponsavel = {
    responsavel_nome: String(body.responsavel_nome ?? "").trim() || null,
    responsavel_cpf:
      String(body.responsavel_cpf ?? "").replace(/\D/g, "") || null,
    responsavel_rg: String(body.responsavel_rg ?? "").trim() || null,
    responsavel_rg_orgao:
      String(body.responsavel_rg_orgao ?? "").trim() || null,
    responsavel_telefone: body.responsavel_telefone
      ? normalizarTelefone(String(body.responsavel_telefone))
      : null,
    responsavel_email: String(body.responsavel_email ?? "").trim() || null,
    responsavel_parentesco:
      String(body.responsavel_parentesco ?? "").trim() || null,
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
          state       = COALESCE(${camposOpcionais.estado}, state),
          menor_incapaz        = COALESCE(${menorIncapazBody}, menor_incapaz),
          responsavel_nome     = COALESCE(${camposResponsavel.responsavel_nome}, responsavel_nome),
          responsavel_cpf      = COALESCE(${camposResponsavel.responsavel_cpf}, responsavel_cpf),
          responsavel_rg       = COALESCE(${camposResponsavel.responsavel_rg}, responsavel_rg),
          responsavel_rg_orgao = COALESCE(${camposResponsavel.responsavel_rg_orgao}, responsavel_rg_orgao),
          responsavel_telefone = COALESCE(${camposResponsavel.responsavel_telefone}, responsavel_telefone),
          responsavel_email    = COALESCE(${camposResponsavel.responsavel_email}, responsavel_email),
          responsavel_parentesco = COALESCE(${camposResponsavel.responsavel_parentesco}, responsavel_parentesco)
        WHERE id = ${clienteId}::uuid
      `;
    } else {
      const rows = await sql`
        INSERT INTO clients (
          type, name, doc, email, phone,
          rg, rg_orgao, estado_civil, profissao,
          cep, street, addr_number, neighborhood, city, state,
          menor_incapaz, responsavel_nome, responsavel_cpf, responsavel_rg,
          responsavel_rg_orgao, responsavel_telefone, responsavel_email,
          responsavel_parentesco,
          status
        ) VALUES (
          'PF', ${nome}, ${cpfRaw}, ${email ?? ""}, ${telefone},
          ${camposOpcionais.rg}, ${camposOpcionais.rg_orgao}, ${camposOpcionais.estado_civil}, ${camposOpcionais.profissao},
          ${camposOpcionais.cep}, ${camposOpcionais.endereco}, ${camposOpcionais.numero}, ${camposOpcionais.bairro}, ${camposOpcionais.cidade}, ${camposOpcionais.estado},
          ${menorIncapazBody ?? false}, ${camposResponsavel.responsavel_nome}, ${camposResponsavel.responsavel_cpf}, ${camposResponsavel.responsavel_rg},
          ${camposResponsavel.responsavel_rg_orgao}, ${camposResponsavel.responsavel_telefone}, ${camposResponsavel.responsavel_email},
          ${camposResponsavel.responsavel_parentesco},
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
    // usar_prevbot_contrato é obrigatório aqui — sem ele, qualquer outro
    // modelo marcado requer_responsavel_legal=true (ex: Formulário LOAS)
    // colidiria e poderia ser escolhido no lugar do contrato de verdade.
    const modelos = await getModelosAtivos();
    const requerResponsavel = client.menor_incapaz;
    const modelo = modelos.find(
      (m) =>
        m.usar_prevbot_contrato &&
        m.requer_responsavel_legal === requerResponsavel
    );
    if (!modelo) {
      return NextResponse.json(
        {
          ok: false,
          error: `Nenhum modelo de contrato ativo configurado (usar_prevbot_contrato=true, requer_responsavel_legal=${requerResponsavel}). Cadastre em Documentos → Modelos.`,
        },
        { status: 422 }
      );
    }

    // ── 2b. Salva respostas das perguntas_extras (ex: b.1 a b.5 do
    // Formulário LOAS) que o PrevBot já tenha coletado na conversa —
    // pedido do Orlando (2026-10-31): se o cliente já respondeu no
    // WhatsApp, não faz sentido perguntar tudo de novo quando um
    // colaborador for gerar o Formulário LOAS manualmente depois (hoje só
    // isso: a API não gera esse documento sozinha, mas pré-preenche pra
    // quando alguém gerar). Mesma regra de segurança de assinaturas-actions
    // (adicionarDocumentoAction) — só aceita tag que algum modelo ATIVO
    // realmente declarou em perguntas_extras, pra não deixar a chamada
    // injetar uma variável arbitrária em qualquer documento futuro desse
    // cliente. Merge (não substitui), mesma regra de lá.
    const tagsPermitidas = new Set(
      modelos.flatMap((m) => (m.perguntas_extras ?? []).map((p) => p.tag))
    );
    const respostasExtrasBrutas =
      body.respostas_extras && typeof body.respostas_extras === "object"
        ? (body.respostas_extras as Record<string, unknown>)
        : {};
    const respostasValidas: Record<string, string> = {};
    for (const [tag, valor] of Object.entries(respostasExtrasBrutas)) {
      if (
        tagsPermitidas.has(tag) &&
        typeof valor === "string" &&
        valor.trim()
      ) {
        respostasValidas[tag] = valor.trim();
      }
    }
    if (Object.keys(respostasValidas).length > 0) {
      await sql`
        UPDATE clients
        SET respostas_extras = COALESCE(respostas_extras, '{}'::jsonb) || ${JSON.stringify(respostasValidas)}::jsonb
        WHERE id = ${clienteId}::uuid
      `.catch((e) =>
        console.error("[prevbot/contrato] falha ao salvar respostas_extras:", e)
      );
    }

    // ── 2c. Bundle automático por benefício — pedido do Orlando
    // (2026-10-31): "se o cliente responder no whatsapp as perguntas ele já
    // pode gerar o documento e enviar todos pro cliente já preenchido".
    // Um modelo entra no bundle se: (a) está marcado pra esse `beneficio`
    // em beneficios_aplicaveis, e (b) se ele declara perguntas_extras (caso
    // do Formulário LOAS), TODAS precisam já estar respondidas — senão ele
    // fica de fora e continua manual com um colaborador (pedido explícito
    // do Orlando pra não perder o cliente nem mandar documento com lacuna
    // visível tipo "b.1: ____").
    const respostasTotaisPorTag: Record<string, string> = {
      ...(client.respostas_extras ?? {}),
      ...respostasValidas,
    };
    const extras = beneficio
      ? modelos.filter((m) => {
          if (m.id === modelo.id) return false;
          if (!(m.beneficios_aplicaveis ?? []).includes(beneficio))
            return false;
          const tags = (m.perguntas_extras ?? []).map((p) => p.tag);
          return tags.every((t) => respostasTotaisPorTag[t]?.trim());
        })
      : [];

    // Quem assina — bug real encontrado em 2026-10-31: esta rota sempre
    // montava o assinante com os dados do BENEFICIÁRIO, mesmo escolhendo o
    // modelo "requer responsável legal" acima. A tela manual de Assinaturas
    // (novo-envelope.tsx) já troca pelo responsável quando o cliente é
    // menor/incapaz — replicado aqui. Erra travando (422) em vez de assinar
    // com a pessoa errada: é exatamente o tipo de erro silencioso que não
    // pode se repetir (caso real de cliente ligando confuso por mensagem
    // errada, 2026-10).
    if (requerResponsavel && !client.responsavel_nome) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Cliente marcado como menor/incapaz mas sem responsável legal cadastrado (responsavel_nome). Envie responsavel_nome (e responsavel_cpf/telefone/email) no payload antes de gerar o contrato.",
        },
        { status: 422 }
      );
    }
    const assinanteNome = requerResponsavel
      ? String(client.responsavel_nome)
      : nome;
    const assinanteEmail = requerResponsavel
      ? (client.responsavel_email ?? "")
      : (email ?? "");

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
    // client.respostas_extras foi lido ANTES do merge acima — sobrepõe aqui
    // pra esta própria geração já refletir uma resposta que acabou de
    // chegar nesta mesma chamada (hoje não afeta o contrato de honorários,
    // que não tem perguntas_extras, mas evita a pegadinha se isso mudar).
    for (const [tag, valor] of Object.entries(respostasValidas)) {
      vars[`{{${tag}}}`] = valor;
    }
    const html = modelo.conteudo_blocks
      ? blocksToHtml(substituteVariablesInBlocks(modelo.conteudo_blocks, vars))
      : textToHtml(replaceVars(modelo.conteudo, vars));

    // Os documentos extras (Termo BPC-LOAS, Declaração de Renúncia Bolsa
    // Família, Termo de Representação) usam {{responsavel_nome}}/
    // {{responsavel_cpf}} incondicionalmente no texto cadastrado — faz
    // sentido no caso com responsável, mas pra um adulto capaz assinando
    // por si mesmo (ex: BPC idoso sem representante) esses campos ficariam
    // em branco no documento final, já que buildModeloVars só preenche
    // {{responsavel_*}} quando existe responsável cadastrado. Sobrepõe
    // aqui pra sempre resolver pra quem realmente assina.
    const varsExtras = { ...vars };
    if (!requerResponsavel) {
      varsExtras["{{responsavel_nome}}"] = nome;
      varsExtras["{{responsavel_cpf}}"] = client.doc;
    }
    const documentosExtras = extras.map((m, i) => ({
      modeloId: m.id,
      nome: m.titulo,
      htmlContent: m.conteudo_blocks
        ? blocksToHtml(
            substituteVariablesInBlocks(m.conteudo_blocks, varsExtras)
          )
        : textToHtml(replaceVars(m.conteudo, varsExtras)),
      ordem: i + 2,
    }));

    // ── 4. Cria o envelope (registro interno) ──
    const criadoPor = await resolverAdminLogin();
    const { id: envelopeId } = await criarEnvelope({
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
          nome: assinanteNome,
          email: assinanteEmail,
          papel: "assinante",
          valEmail: false,
          valSelfie: true,
          valDocumento: true,
          valAssinaturaDesenhada: false,
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
        ...documentosExtras,
      ],
    });

    // ── 5. Envia pro TramitaSign de verdade (gera o PDF, sobe, cria o
    // envelope remoto, cadastra o assinante e manda pra assinatura) ──
    const envio = await enviarEnvelopeParaTramitaSign(envelopeId);
    const envelopeAtualizado = await getEnvelopeById(envelopeId);
    const assinanteAtualizado = envelopeAtualizado?.assinantes[0];
    if (envio.error || !assinanteAtualizado?.tramitasignLink) {
      return NextResponse.json(
        {
          ok: false,
          error: envio.error ?? "TramitaSign não retornou link de assinatura.",
        },
        { status: 502 }
      );
    }
    const link = assinanteAtualizado.tramitasignLink;

    // ── 6. Sincroniza com crm_leads — é isso que faz o webhook do TramitaSign
    // (quando o cliente assinar) reconhecer que é um lead do PrevBot e avisar
    // de volta via PREVBOT_CALLBACK_URL. contrato_id usa o UUID do nosso
    // próprio envelope — é isso que o webhook casa de volta.
    const existenteLead = telefone
      ? await sql`SELECT id::text FROM crm_leads WHERE telefone = ${telefone} AND origem = 'prevbot' LIMIT 1`
      : [];
    if (existenteLead.length > 0) {
      await sql`
        UPDATE crm_leads SET
          contrato_id = ${envelopeId},
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
          (${nome}, ${email}, ${telefone}, 'PF', 'novo_contato', 'prevbot', ${prevbotLeadId}, ${envelopeId}, 'aguardando_assinatura', ${clienteId}::uuid)
      `;
    }

    return NextResponse.json({
      ok: true,
      link,
      documento_id: envelopeId,
      client_id: clienteId,
      modelo: modelo.titulo,
      documentos_incluidos: [modelo.titulo, ...extras.map((m) => m.titulo)],
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
