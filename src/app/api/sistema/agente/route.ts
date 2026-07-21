import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import sql from "@/lib/db";
import { enviarMensagemDireta } from "@/lib/prevbot-outbound";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Definição das ferramentas ─────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "verificar_saude",
    description:
      "Verifica o status de todos os componentes do sistema: banco de dados, variáveis de ambiente, OABs monitoradas, mensagens WhatsApp pendentes, publicações não lidas.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "obter_estatisticas",
    description:
      "Retorna estatísticas do sistema: total de clientes, processos, publicações, leads e OABs ativas.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "sincronizar_publicacoes",
    description:
      "Busca novas publicações e intimações em todas as fontes (DJe, DJEN/TRF5, TramitaSign). Use quando o usuário pedir para buscar publicações ou não estiver recebendo intimações.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "reenviar_mensagens_falhadas",
    description:
      "Reenvia mensagens WhatsApp que estão na fila de pendentes ou que falharam. Use quando mensagens não chegaram ao cliente.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "listar_oabs",
    description: "Lista todas as OABs monitoradas pelo sistema com status.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "adicionar_oab",
    description:
      "Adiciona uma nova OAB para monitoramento automático de publicações no DJe.",
    input_schema: {
      type: "object",
      properties: {
        numero: {
          type: "string",
          description: "Número da OAB (somente dígitos, ex: 14381)",
        },
        estado: {
          type: "string",
          description: "Sigla do estado (ex: AL, SP, RJ)",
        },
        nome_advogado: {
          type: "string",
          description: "Nome do advogado (opcional)",
        },
      },
      required: ["numero", "estado"],
    },
  },
  {
    name: "remover_oab",
    description: "Remove uma OAB do monitoramento de publicações.",
    input_schema: {
      type: "object",
      properties: {
        numero: { type: "string", description: "Número da OAB" },
        estado: { type: "string", description: "Sigla do estado" },
      },
      required: ["numero", "estado"],
    },
  },
  {
    name: "atualizar_escritorio",
    description:
      "Atualiza dados do escritório. Campos permitidos: telefone, email, nome, cidade, estado, endereco, oab, cnpj, site, cep.",
    input_schema: {
      type: "object",
      properties: {
        campo: {
          type: "string",
          description:
            "Nome do campo: telefone, email, nome, cidade, estado, endereco, oab, cnpj, site, cep",
        },
        valor: { type: "string", description: "Novo valor para o campo" },
      },
      required: ["campo", "valor"],
    },
  },
  {
    name: "testar_whatsapp",
    description:
      "Envia uma mensagem de teste pelo WhatsApp para verificar se a integração está funcionando.",
    input_schema: {
      type: "object",
      properties: {
        telefone: {
          type: "string",
          description: "Número do telefone com DDD (somente dígitos)",
        },
        mensagem: { type: "string", description: "Texto da mensagem" },
      },
      required: ["telefone", "mensagem"],
    },
  },
  {
    name: "ver_erros",
    description:
      "Mostra os erros e mensagens falhadas recentes do sistema para diagnóstico.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

// ── Executor das ferramentas ──────────────────────────────────────────────────

async function executarFerramenta(
  name: string,
  input: Record<string, string>
): Promise<string> {
  switch (name) {
    case "verificar_saude": {
      const checks: { componente: string; ok: boolean; detalhe: string }[] = [];

      try {
        await sql`SELECT 1`;
        checks.push({
          componente: "Banco de dados (Neon)",
          ok: true,
          detalhe: "Conectado",
        });
      } catch {
        checks.push({
          componente: "Banco de dados (Neon)",
          ok: false,
          detalhe: "Erro de conexão",
        });
      }

      const envVars = [
        { key: "ANTHROPIC_API_KEY", label: "IA (Claude)" },
        { key: "PREVBOT_WEBHOOK_URL", label: "WhatsApp (PrevBot)" },
        { key: "RESEND_API_KEY", label: "E-mail (Resend)" },
        { key: "TRAMITASIGN_WEBHOOK_SECRET", label: "TramitaSign webhook" },
      ];
      for (const { key, label } of envVars) {
        const val = process.env[key];
        checks.push({
          componente: label,
          ok: !!val && val.length > 0,
          detalhe:
            !!val && val.length > 0 ? "Configurado" : `${key} não configurado`,
        });
      }

      const [oabs, pubs, fila] = await Promise.all([
        sql`SELECT COUNT(*) as total, SUM(CASE WHEN ativa THEN 1 ELSE 0 END)::int as ativas FROM oabs_monitoradas`,
        sql`SELECT COUNT(*) as total FROM publicacoes WHERE status = 'nao_lida'`,
        sql`SELECT COUNT(*) as total FROM prevbot_webhook_log WHERE status = 'pendente'`,
      ]);

      checks.push({
        componente: "OABs monitoradas",
        ok: Number(oabs[0].ativas) > 0,
        detalhe: `${oabs[0].ativas} ativas de ${oabs[0].total} cadastradas`,
      });
      checks.push({
        componente: "Publicações não lidas",
        ok: true,
        detalhe: `${pubs[0].total} aguardando tratamento`,
      });
      checks.push({
        componente: "Fila WhatsApp",
        ok: Number(fila[0].total) === 0,
        detalhe:
          Number(fila[0].total) === 0
            ? "Nenhuma pendente"
            : `${fila[0].total} mensagens na fila`,
      });

      return JSON.stringify(checks);
    }

    case "obter_estatisticas": {
      const [clientes, processos, pubs, leads, oabs] = await Promise.all([
        sql`SELECT COUNT(*) as total FROM clients`,
        sql`SELECT COUNT(*) as total FROM processos WHERE deleted_at IS NULL`,
        sql`SELECT COUNT(*) as total, SUM(CASE WHEN status = 'nao_lida' THEN 1 ELSE 0 END)::int as nao_lidas FROM publicacoes`,
        sql`SELECT COUNT(*) as total FROM crm_leads`,
        sql`SELECT COUNT(*) as total FROM oabs_monitoradas WHERE ativa = true`,
      ]);
      return JSON.stringify({
        clientes: clientes[0].total,
        processos: processos[0].total,
        publicacoes_total: pubs[0].total,
        publicacoes_nao_lidas: pubs[0].nao_lidas,
        leads_crm: leads[0].total,
        oabs_ativas: oabs[0].total,
      });
    }

    case "sincronizar_publicacoes": {
      let total = 0;
      const fontes: string[] = [];

      const { sincronizarDJEN } = await import("@/lib/djen");
      const djen = await sincronizarDJEN(7).catch(() => 0);
      total += djen;
      fontes.push(`DJEN/TRF5: +${djen}`);

      const { buscarPublicacoesDjeEsaj } = await import("@/lib/dje-esaj");
      const oabs =
        await sql`SELECT id::text, numero, estado, nome_advogado FROM oabs_monitoradas WHERE ativa = true`;
      let dje = 0;
      for (const oab of oabs) {
        dje += await buscarPublicacoesDjeEsaj(
          {
            id: String(oab.id),
            numero: String(oab.numero),
            estado: String(oab.estado),
            nome_advogado: oab.nome_advogado ? String(oab.nome_advogado) : null,
          },
          7
        ).catch(() => 0);
      }
      total += dje;
      fontes.push(`DJe/eSAJ: +${dje}`);

      const { sincronizarTramitaSign, tramitaSyncAtivo } =
        await import("@/lib/tramitasign-sync");
      if (tramitaSyncAtivo()) {
        const ts = await sincronizarTramitaSign(7).catch(() => ({
          inseridos: 0,
        }));
        total += ts.inseridos;
        fontes.push(`TramitaSign: +${ts.inseridos}`);
      } else {
        fontes.push("TramitaSign: sem credenciais");
      }

      return JSON.stringify({ total_novas: total, fontes });
    }

    case "reenviar_mensagens_falhadas": {
      const { _enviarWebhook } = await import("@/lib/prevbot-outbound");
      const webhookKey =
        process.env.PREVBOT_WEBHOOK_KEY ?? process.env.PREVBOT_API_KEY;
      if (!webhookKey)
        return JSON.stringify({ erro: "PREVBOT_WEBHOOK_KEY não configurada" });

      const pendentes = await sql`
        SELECT id::text, payload, tentativas FROM prevbot_webhook_log
        WHERE status = 'pendente' AND tentativas < 3
        ORDER BY created_at ASC LIMIT 20
      `;

      let enviados = 0,
        falhos = 0;
      for (const row of pendentes) {
        const resultado = await _enviarWebhook(
          webhookKey,
          row.payload as Record<string, unknown>
        );
        const novasTentativas = Number(row.tentativas) + 1;
        if (resultado.ok) {
          await sql`UPDATE prevbot_webhook_log SET status = 'enviado', tentativas = ${novasTentativas}, enviado_em = NOW() WHERE id = ${String(row.id)}::uuid`;
          enviados++;
        } else {
          const novoStatus = novasTentativas >= 3 ? "falhou" : "pendente";
          await sql`UPDATE prevbot_webhook_log SET tentativas = ${novasTentativas}, status = ${novoStatus} WHERE id = ${String(row.id)}::uuid`;
          falhos++;
        }
      }
      return JSON.stringify({
        processadas: pendentes.length,
        enviadas: enviados,
        falharam: falhos,
      });
    }

    case "listar_oabs": {
      const oabs =
        await sql`SELECT numero, estado, nome_advogado, ativa, ultima_busca FROM oabs_monitoradas ORDER BY estado, numero`;
      return JSON.stringify(
        oabs.map((o) => ({
          numero: o.numero,
          estado: o.estado,
          nome: o.nome_advogado ?? "—",
          ativa: o.ativa,
          ultima_busca: o.ultima_busca
            ? new Date(o.ultima_busca as string).toLocaleDateString("pt-BR")
            : "Nunca",
        }))
      );
    }

    case "adicionar_oab": {
      const { numero, estado, nome_advogado } = input;
      const existe =
        await sql`SELECT id FROM oabs_monitoradas WHERE numero = ${numero} AND estado = ${estado}`;
      if (existe.length > 0)
        return JSON.stringify({
          ok: false,
          mensagem: `OAB ${numero}/${estado} já cadastrada`,
        });
      await sql`INSERT INTO oabs_monitoradas (numero, estado, nome_advogado, ativa) VALUES (${numero}, ${estado}, ${nome_advogado ?? null}, true)`;
      return JSON.stringify({
        ok: true,
        mensagem: `OAB ${numero}/${estado} adicionada com sucesso`,
      });
    }

    case "remover_oab": {
      const { numero, estado } = input;
      const deletedRows =
        await sql`DELETE FROM oabs_monitoradas WHERE numero = ${numero} AND estado = ${estado} RETURNING id`;
      return JSON.stringify({
        ok: true,
        mensagem:
          deletedRows.length > 0
            ? `OAB ${numero}/${estado} removida`
            : "OAB não encontrada",
      });
    }

    case "atualizar_escritorio": {
      const { campo, valor } = input;
      switch (campo) {
        case "telefone":
          await sql`UPDATE escritorio_config SET telefone = ${valor}`;
          break;
        case "email":
          await sql`UPDATE escritorio_config SET email = ${valor}`;
          break;
        case "nome":
          await sql`UPDATE escritorio_config SET nome = ${valor}`;
          break;
        case "cidade":
          await sql`UPDATE escritorio_config SET cidade = ${valor}`;
          break;
        case "estado":
          await sql`UPDATE escritorio_config SET estado = ${valor}`;
          break;
        case "endereco":
          await sql`UPDATE escritorio_config SET endereco = ${valor}`;
          break;
        case "oab":
          await sql`UPDATE escritorio_config SET oab = ${valor}`;
          break;
        case "cnpj":
          await sql`UPDATE escritorio_config SET cnpj = ${valor}`;
          break;
        case "site":
          await sql`UPDATE escritorio_config SET site = ${valor}`;
          break;
        case "cep":
          await sql`UPDATE escritorio_config SET cep = ${valor}`;
          break;
        default:
          return JSON.stringify({
            ok: false,
            mensagem: `Campo "${campo}" não permitido`,
          });
      }
      return JSON.stringify({
        ok: true,
        mensagem: `${campo} atualizado para "${valor}"`,
      });
    }

    case "testar_whatsapp": {
      const { telefone, mensagem } = input;
      const resultado = await enviarMensagemDireta({ telefone, mensagem });
      return JSON.stringify(resultado);
    }

    case "ver_erros": {
      const [resumo, recentes] = await Promise.all([
        sql`SELECT status, COUNT(*) as total FROM prevbot_webhook_log GROUP BY status ORDER BY total DESC`,
        sql`
          SELECT payload->>'evento' as evento, status, ultimo_erro, tentativas, created_at::text
          FROM prevbot_webhook_log WHERE status IN ('pendente', 'falhou')
          ORDER BY created_at DESC LIMIT 10
        `,
      ]);
      return JSON.stringify({ resumo_fila: resumo, erros_recentes: recentes });
    }

    default:
      return JSON.stringify({ erro: `Ferramenta "${name}" não reconhecida` });
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

const SYSTEM = `Você é o Agente do Sistema LiderAdv — um assistente com poderes para executar ações reais no sistema jurídico.

Suas capacidades:
- Verificar saúde do sistema e detectar problemas
- Sincronizar publicações/intimações
- Reenviar mensagens WhatsApp que falharam
- Gerenciar OABs monitoradas (listar, adicionar, remover)
- Atualizar dados do escritório (telefone, e-mail, endereço, etc.)
- Testar integração WhatsApp
- Ver logs de erros

Quando o usuário pedir algo, USE as ferramentas disponíveis — não apenas descreva o que poderia fazer.
Após executar, reporte claramente o resultado com emojis: ✅ sucesso, ❌ erro, ⚠️ atenção.
Seja conciso e direto. Confirme o que foi feito.`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasPermission(session, "configuracoes", "ver")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { messages } = (await req.json()) as {
    messages: Anthropic.MessageParam[];
  };
  if (!messages?.length)
    return NextResponse.json(
      { error: "Mensagens inválidas." },
      { status: 400 }
    );

  const currentMessages = [...messages];

  for (let i = 0; i < 6; i++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM,
      tools: TOOLS,
      messages: currentMessages,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n");
      return NextResponse.json({ reply: text });
    }

    if (response.stop_reason === "tool_use") {
      currentMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executarFerramenta(
            block.name,
            block.input as Record<string, string>
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }
      currentMessages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return NextResponse.json({
    reply: "Não consegui completar a operação. Tente novamente.",
  });
}
