import Anthropic from "@anthropic-ai/sdk";
import sql from "./db";
import { enviarMensagemDireta } from "./prevbot-outbound";
import { getLancamentoKpis, getContasAReceber } from "./lancamentos-db";
import { hasPermission } from "./permissoes";
import { getColaboradorIdForUser } from "./usuarios-db";
import type { SessionUser } from "./session";

export const IRIS_TOOLS: Anthropic.Tool[] = [
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
      "Busca novas publicações e intimações em todas as fontes (DJe, DJEN/TRF5, TramitaSign). Ação real — requer permissão de administrador.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "reenviar_mensagens_falhadas",
    description:
      "Reenvia eventos CRM (honorário pago, processo deferido etc.) que estão na fila de pendentes. Ação real — requer permissão de administrador.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "reenviar_lembretes",
    description:
      "Reenvia os lembretes WhatsApp pendentes de agenda, honorários e pagamentos que ainda não foram enviados. Ação real — requer permissão de administrador.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "cancelar_lembretes_atrasados",
    description:
      "Cancela (sem enviar) todos os lembretes que já passaram da data. Ação real — requer permissão de administrador.",
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
      "Adiciona uma nova OAB para monitoramento automático de publicações. Ação real — requer permissão de administrador.",
    input_schema: {
      type: "object",
      properties: {
        numero: {
          type: "string",
          description: "Número da OAB (somente dígitos, ex: 14381)",
        },
        estado: { type: "string", description: "Sigla do estado (ex: AL)" },
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
    description:
      "Remove uma OAB do monitoramento de publicações. Ação real — requer permissão de administrador.",
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
      "Atualiza dados do escritório. Campos permitidos: telefone, email, nome, cidade, estado, endereco, oab, cnpj, site, cep. Ação real — requer permissão de administrador.",
    input_schema: {
      type: "object",
      properties: {
        campo: { type: "string" },
        valor: { type: "string" },
      },
      required: ["campo", "valor"],
    },
  },
  {
    name: "testar_whatsapp",
    description:
      "Envia uma mensagem de teste pelo WhatsApp. Ação real — requer permissão de administrador.",
    input_schema: {
      type: "object",
      properties: {
        telefone: { type: "string" },
        mensagem: { type: "string" },
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
  {
    name: "consultar_financeiro",
    description:
      "Consulta dados financeiros do escritório: KPIs gerais e contas a receber por cliente. Use quando pedirem contas em aberto, histórico de pagamentos ou situação financeira geral.",
    input_schema: {
      type: "object",
      properties: {
        cliente_nome: {
          type: "string",
          description:
            "Nome do cliente para detalhar. Se omitido, retorna resumo geral.",
        },
      },
      required: [],
    },
  },
  {
    name: "listar_processos_risco",
    description:
      "Lista processos ativos (não arquivados/encerrados) analisados pelo Cérebro Jurídico, com risco (alto/médio/baixo) e probabilidade de êxito. Use quando o usuário perguntar sobre risco de processos, quais casos precisam de atenção, ou quer uma visão geral das análises do Cérebro Jurídico.",
    input_schema: {
      type: "object",
      properties: {
        risco: {
          type: "string",
          description:
            "Filtra por 'alto', 'medio' ou 'baixo'. Se omitido, traz todos ordenados do maior risco pro menor.",
        },
      },
      required: [],
    },
  },
  {
    name: "consultar_analise_cerebro",
    description:
      "Traz a análise mais recente do Cérebro Jurídico (risco, probabilidade de êxito, próxima ação, base legal) para um cliente ou processo específico, pelo nome do cliente ou número do processo.",
    input_schema: {
      type: "object",
      properties: {
        busca: {
          type: "string",
          description:
            "Nome do cliente (ou parte) ou número do processo (CNJ).",
        },
      },
      required: ["busca"],
    },
  },
];

/** Ferramentas que executam mudança real no sistema — exigem configuracoes:editar. */
const FERRAMENTAS_MUTANTES = new Set([
  "sincronizar_publicacoes",
  "reenviar_mensagens_falhadas",
  "reenviar_lembretes",
  "cancelar_lembretes_atrasados",
  "adicionar_oab",
  "remover_oab",
  "atualizar_escritorio",
  "testar_whatsapp",
]);

/**
 * Diagnóstico/config do sistema (inclui log de WhatsApp com nome+telefone
 * de cliente em ver_erros) — mesmo padrão do antigo "Agente do Sistema",
 * que era 100% restrito a administrador. Ao fundir tudo na Íris, esse
 * gate quase ficou de fora (só as mutantes continuaram checadas) — um
 * usuário sem privilégio de admin conseguiria puxar esses dados
 * operacionais/PII só perguntando. Corrigido: exige configuracoes:ver.
 */
const FERRAMENTAS_DIAGNOSTICO = new Set([
  "verificar_saude",
  "obter_estatisticas",
  "ver_erros",
  "listar_oabs",
]);

export async function executarFerramentaIris(
  session: SessionUser,
  name: string,
  input: Record<string, string>
): Promise<string> {
  if (
    FERRAMENTAS_MUTANTES.has(name) &&
    !hasPermission(session, "configuracoes", "editar")
  ) {
    return JSON.stringify({
      ok: false,
      erro: "Este usuário não tem permissão de administrador para executar essa ação. Explique isso educadamente e não tente de novo.",
    });
  }
  if (
    FERRAMENTAS_DIAGNOSTICO.has(name) &&
    !hasPermission(session, "configuracoes", "ver")
  ) {
    return JSON.stringify({
      ok: false,
      erro: "Este usuário não tem permissão pra ver dados de diagnóstico/configuração do sistema. Explique isso educadamente e não tente de novo.",
    });
  }
  if (
    name === "consultar_financeiro" &&
    !hasPermission(session, "financeiro", "ver")
  ) {
    return JSON.stringify({
      ok: false,
      erro: "Este usuário não tem permissão pra ver dados financeiros do escritório. Explique isso educadamente e não tente de novo.",
    });
  }
  if (
    (name === "listar_processos_risco" ||
      name === "consultar_analise_cerebro") &&
    !hasPermission(session, "processos", "ver")
  ) {
    return JSON.stringify({
      ok: false,
      erro: "Este usuário não tem permissão pra ver processos. Explique isso educadamente e não tente de novo.",
    });
  }

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

      const { sincronizarDJEN } = await import("./djen");
      const djen = await sincronizarDJEN(7).catch(() => 0);
      total += djen;
      fontes.push(`DJEN/TRF5: +${djen}`);

      const { buscarPublicacoesDjeEsaj } = await import("./dje-esaj");
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
        await import("./tramitasign-sync");
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
      const webhookKey =
        process.env.PREVBOT_WEBHOOK_KEY ?? process.env.PREVBOT_API_KEY;
      if (!webhookKey)
        return JSON.stringify({ erro: "PREVBOT_WEBHOOK_KEY não configurada" });
      const { _enviarWebhook } = await import("./prevbot-outbound");

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
      const numero = String(input.numero ?? "").replace(/\D/g, "");
      const estado = String(input.estado ?? "")
        .toUpperCase()
        .slice(0, 2);
      const nome_advogado = input.nome_advogado
        ? String(input.nome_advogado).trim().slice(0, 120)
        : null;
      if (!numero || !/^[A-Z]{2}$/.test(estado))
        return JSON.stringify({
          ok: false,
          mensagem: "Número da OAB ou UF inválidos.",
        });
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
      const campo = String(input.campo ?? "");
      const valor = String(input.valor ?? "")
        .trim()
        .slice(0, 300);
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
      const digitos = String(input.telefone ?? "").replace(/\D/g, "");
      if (digitos.length < 10 || digitos.length > 13)
        return JSON.stringify({
          ok: false,
          error: "Telefone inválido (informe DDD + número).",
        });
      const mensagem = String(input.mensagem ?? "")
        .trim()
        .slice(0, 1000);
      if (!mensagem)
        return JSON.stringify({ ok: false, error: "Mensagem vazia." });
      const resultado = await enviarMensagemDireta({
        telefone: digitos,
        mensagem,
      });
      return JSON.stringify(resultado);
    }

    case "cancelar_lembretes_atrasados": {
      const [{ total }] = await sql`
        SELECT COUNT(*)::int AS total
        FROM lembretes_agendados
        WHERE NOT enviado AND enviar_em <= NOW()
      `;
      await sql`
        UPDATE lembretes_agendados
        SET enviado = TRUE, enviado_em = NOW(), erro = 'cancelado_manualmente'
        WHERE NOT enviado
          AND enviar_em <= NOW()
      `;
      return JSON.stringify({
        ok: true,
        cancelados: total,
        mensagem:
          total > 0
            ? `${total} lembrete${Number(total) !== 1 ? "s" : ""} antigo${Number(total) !== 1 ? "s" : ""} cancelado${Number(total) !== 1 ? "s" : ""} sem envio.`
            : "Nenhum lembrete atrasado encontrado.",
      });
    }

    case "ver_erros": {
      const [resumoCRM, errosCRM, resumoLembretes, errosLembretes] =
        await Promise.all([
          sql`SELECT status, COUNT(*) as total FROM prevbot_webhook_log GROUP BY status ORDER BY total DESC`,
          sql`
            SELECT payload->>'evento' as evento, status, ultimo_erro, tentativas, created_at::text
            FROM prevbot_webhook_log WHERE status IN ('pendente', 'falhou')
            ORDER BY created_at DESC LIMIT 5
          `,
          sql`
            SELECT enviado, COUNT(*) as total,
                   SUM(CASE WHEN tentativas >= 3 AND NOT enviado THEN 1 ELSE 0 END)::int as bloqueados
            FROM lembretes_agendados
            GROUP BY enviado
          `,
          sql`
            SELECT tipo, destinatario_nome, destinatario_telefone, erro,
                   tentativas, enviar_em::text, enviado
            FROM lembretes_agendados
            WHERE (NOT enviado AND enviar_em <= NOW()) OR erro IS NOT NULL
            ORDER BY enviar_em DESC LIMIT 10
          `,
        ]);
      return JSON.stringify({
        crm_webhook: { resumo: resumoCRM, erros_recentes: errosCRM },
        lembretes_whatsapp: {
          resumo: resumoLembretes,
          pendentes_com_erro: errosLembretes,
        },
      });
    }

    case "reenviar_lembretes": {
      const pendentes = await sql`
        SELECT id::text, destinatario_telefone, mensagem, tipo, tentativas
        FROM lembretes_agendados
        WHERE NOT enviado
          AND enviar_em <= NOW()
          AND tentativas < 3
        ORDER BY enviar_em ASC
        LIMIT 30
      `;

      if (pendentes.length === 0)
        return JSON.stringify({
          ok: true,
          mensagem: "Nenhuma mensagem pendente no momento.",
        });

      let enviados = 0;
      let falhos = 0;
      const erros: string[] = [];

      for (const lembrete of pendentes) {
        const id = String(lembrete.id);
        const telefone = String(lembrete.destinatario_telefone ?? "");
        const mensagem = String(lembrete.mensagem ?? "");

        if (!telefone || !mensagem) {
          await sql`UPDATE lembretes_agendados SET enviado = TRUE, enviado_em = NOW(), erro = 'telefone ou mensagem vazio' WHERE id = ${id}::uuid`;
          continue;
        }

        const resultado = await enviarMensagemDireta({ telefone, mensagem });
        const novasTentativas = Number(lembrete.tentativas) + 1;

        if (resultado.ok) {
          await sql`UPDATE lembretes_agendados SET enviado = TRUE, enviado_em = NOW(), tentativas = ${novasTentativas} WHERE id = ${id}::uuid`;
          enviados++;
        } else {
          await sql`UPDATE lembretes_agendados SET tentativas = ${novasTentativas}, erro = ${resultado.error ?? "erro desconhecido"} WHERE id = ${id}::uuid`;
          falhos++;
          if (erros.length < 3)
            erros.push(`${lembrete.tipo}: ${resultado.error}`);
        }
      }

      return JSON.stringify({
        processados: pendentes.length,
        enviados,
        falhos,
        erros_amostra: erros,
      });
    }

    case "consultar_financeiro": {
      const kpis = await getLancamentoKpis();
      const contas = await getContasAReceber();

      const cliente_nome =
        typeof input.cliente_nome === "string" ? input.cliente_nome.trim() : "";
      if (cliente_nome) {
        const termo = cliente_nome.toLowerCase();
        const encontrados = contas.filter((c) =>
          c.client_name.toLowerCase().includes(termo)
        );
        if (encontrados.length === 0) {
          return JSON.stringify({
            mensagem: `Nenhum cliente encontrado com o nome "${cliente_nome}".`,
          });
        }
        return JSON.stringify({
          clientes: encontrados.map((c) => ({
            nome: c.client_name,
            documento: c.client_doc,
            total_pendente: c.totalPendente,
            total_pago: c.totalPago,
            lancamentos: c.items.slice(0, 20),
          })),
        });
      }

      return JSON.stringify({
        kpis_gerais: kpis,
        maiores_pendencias: contas.slice(0, 10).map((c) => ({
          nome: c.client_name,
          total_pendente: c.totalPendente,
          total_pago: c.totalPago,
        })),
      });
    }

    case "listar_processos_risco": {
      const riscoFiltro =
        typeof input.risco === "string" ? input.risco.trim().toLowerCase() : "";
      const podeVerTodos = hasPermission(session, "processos_ver_todos", "ver");
      const colaboradorId = podeVerTodos
        ? null
        : await getColaboradorIdForUser(session.id);
      const rows = await sql`
        SELECT DISTINCT ON (ca.processo_id)
          ca.processo_id::text, ca.risco, ca.probabilidade_sucesso,
          ca.proxima_acao, ca.created_at::text AS criado_em,
          p.numero AS processo_numero, cl.name AS cliente_nome
        FROM cerebro_analises ca
        JOIN processos p ON p.id = ca.processo_id
        LEFT JOIN clients cl ON cl.id = p.client_id
        WHERE ca.tipo = 'inicial'
          AND ca.risco IS NOT NULL
          AND p.status NOT IN ('arquivado', 'encerrado')
          AND p.deleted_at IS NULL
          AND (${riscoFiltro} = '' OR ca.risco = ${riscoFiltro})
          AND (${podeVerTodos} OR p.responsavel_id = ${colaboradorId}::uuid)
        ORDER BY ca.processo_id, ca.created_at DESC
      `;
      const ordem: Record<string, number> = { alto: 0, medio: 1, baixo: 2 };
      const ordenado = rows
        .map((r) => ({
          processo_numero: r.processo_numero ?? "—",
          cliente_nome: r.cliente_nome ?? "—",
          risco: r.risco,
          probabilidade_sucesso: r.probabilidade_sucesso,
          proxima_acao: r.proxima_acao,
        }))
        .sort(
          (a, b) =>
            (ordem[String(a.risco)] ?? 3) - (ordem[String(b.risco)] ?? 3)
        );
      return JSON.stringify({
        total: ordenado.length,
        processos: ordenado.slice(0, 30),
      });
    }

    case "consultar_analise_cerebro": {
      const busca = String(input.busca ?? "").trim();
      if (!busca)
        return JSON.stringify({
          erro: "Informe um nome de cliente ou número de processo.",
        });
      const podeVerTodos2 = hasPermission(
        session,
        "processos_ver_todos",
        "ver"
      );
      const colaboradorId2 = podeVerTodos2
        ? null
        : await getColaboradorIdForUser(session.id);
      const rows = await sql`
        SELECT ca.titulo, ca.risco, ca.probabilidade_sucesso, ca.proxima_acao,
               ca.base_legal, ca.created_at::text AS criado_em,
               p.numero AS processo_numero, cl.name AS cliente_nome
        FROM cerebro_analises ca
        JOIN processos p ON p.id = ca.processo_id
        LEFT JOIN clients cl ON cl.id = p.client_id
        WHERE ca.tipo = 'inicial'
          AND p.deleted_at IS NULL
          AND (cl.name ILIKE ${"%" + busca + "%"} OR p.numero ILIKE ${"%" + busca + "%"})
          AND (${podeVerTodos2} OR p.responsavel_id = ${colaboradorId2}::uuid)
        ORDER BY ca.created_at DESC
        LIMIT 5
      `;
      if (rows.length === 0)
        return JSON.stringify({
          mensagem: `Nenhuma análise do Cérebro Jurídico encontrada para "${busca}".`,
        });
      return JSON.stringify({
        analises: rows.map((r) => ({
          cliente: r.cliente_nome ?? "—",
          processo: r.processo_numero ?? "—",
          risco: r.risco,
          probabilidade_sucesso: r.probabilidade_sucesso,
          proxima_acao: r.proxima_acao,
          base_legal: r.base_legal,
          analisado_em: r.criado_em,
        })),
      });
    }

    default:
      return JSON.stringify({ erro: `Ferramenta "${name}" não reconhecida` });
  }
}
