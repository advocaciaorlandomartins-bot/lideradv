import "server-only";
import sql from "./db";

export interface ClienteAguardandoResposta {
  clienteNome: string;
  telefone: string;
  diasSemResposta: number;
}

/**
 * "Cliente sem resposta" — a conversa de WhatsApp em si (mensagens, quem
 * falou por último) vive inteiramente no PrevBot, sistema externo, não é
 * espelhada no banco do LiderAdv. O PrevBot expõe um endpoint read-only
 * pra isso (GET .../status?telefone=...), autenticado com a mesma chave já
 * usada pra mandar mensagem (PREVBOT_WEBHOOK_KEY/PREVBOT_API_KEY) — sem
 * segredo novo pra coordenar entre os dois sistemas.
 *
 * Escopo: só leads do PrevBot ligados a cliente com processo ativo — um
 * lead antigo/caso já encerrado não interessar pra esse alerta.
 */
export async function getClientesAguardandoResposta(
  diasMinimo = 3,
  limiteLeads = 25
): Promise<ClienteAguardandoResposta[]> {
  const key = process.env.PREVBOT_WEBHOOK_KEY ?? process.env.PREVBOT_API_KEY;
  const base = (process.env.PREVBOT_WEBHOOK_URL ?? "").trim();
  if (!key || !base) return [];

  const tenantId =
    process.env.PREVBOT_TENANT_ID ?? base.split("/").pop() ?? "lideradv";
  const statusUrl = `${base.replace(/\/+$/, "")}/status`;

  const leads = await sql`
    SELECT DISTINCT ON (cl.telefone) cl.telefone, cl.nome
    FROM crm_leads cl
    JOIN clients c ON c.id = cl.client_id
    JOIN processos p ON p.client_id = c.id
    WHERE cl.origem = 'prevbot'
      AND cl.telefone IS NOT NULL
      AND p.status IN ('ativo', 'em_andamento')
      AND p.deleted_at IS NULL
    LIMIT ${limiteLeads}
  `;
  if (leads.length === 0) return [];

  const resultados: ClienteAguardandoResposta[] = [];

  for (const lead of leads) {
    const telefone = String(lead.telefone).replace(/\D/g, "");
    if (!telefone) continue;
    try {
      const url = `${statusUrl}?telefone=${encodeURIComponent(telefone)}&tenant_id=${encodeURIComponent(tenantId)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        encontrado?: boolean;
        ultima_atualizacao?: string;
        aguardando_resposta_cliente?: boolean;
      };
      if (
        data.encontrado &&
        data.aguardando_resposta_cliente &&
        data.ultima_atualizacao
      ) {
        const dias = Math.floor(
          (Date.now() - new Date(data.ultima_atualizacao).getTime()) /
            86_400_000
        );
        if (dias >= diasMinimo) {
          resultados.push({
            clienteNome: String(lead.nome ?? "—"),
            telefone,
            diasSemResposta: dias,
          });
        }
      }
    } catch {
      // um lead falhando (timeout, rede) não pode travar os demais
    }
  }

  return resultados.sort((a, b) => b.diasSemResposta - a.diasSemResposta);
}
