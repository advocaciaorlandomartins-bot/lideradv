"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";

function revalidate(id?: string) {
  revalidatePath("/dashboard/producao");
  revalidatePath("/dashboard/processos");
  if (id) revalidatePath(`/dashboard/processos/${id}`);
}

export async function moverParaProducaoAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "producao", "editar")) return;
  await sql`
    UPDATE processos
    SET estagio_producao = 'producao', data_estagio_at = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate(id);
}

export async function moverParaAdministrativoAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "producao", "editar")) return;
  await sql`
    UPDATE processos
    SET estagio_producao = 'administrativo', data_estagio_at = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate(id);
}

export async function registrarResultadoAdminAction(
  id: string,
  resultado: "concedido" | "negado",
  proximoEstagio: "judicial" | "arquivado"
): Promise<{ error?: string }> {
  const user = await getSession();
  if (!user || !hasPermission(user, "producao_resultado_adm", "ver")) {
    return { error: "Sem permissão para registrar resultado administrativo." };
  }
  // Quando o próximo passo é arquivar, processos.status precisa refletir isso —
  // senão o caso continua contando como "ativo" nos KPIs/listas que filtram
  // por status, mesmo já concluído na Linha de Produção.
  const arquivando = proximoEstagio === "arquivado" ? "arquivado" : null;
  await sql`
    UPDATE processos
    SET resultado_administrativo = ${resultado},
        estagio_producao         = ${proximoEstagio},
        status                   = COALESCE(${arquivando}, status),
        fase_workflow            = COALESCE(${arquivando}, fase_workflow),
        data_estagio_at          = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate(id);
  return {};
}

export async function registrarResultadoJudicialAction(
  id: string,
  resultado: "procedente" | "improcedente" | "parcial"
): Promise<{ error?: string }> {
  const user = await getSession();
  if (!user || !hasPermission(user, "producao_resultado_jud", "ver")) {
    return { error: "Sem permissão para registrar resultado judicial." };
  }
  await sql`
    UPDATE processos
    SET resultado_judicial = ${resultado},
        estagio_producao   = 'arquivado',
        status             = 'arquivado',
        fase_workflow      = 'arquivado',
        data_estagio_at    = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate(id);
  return {};
}

/**
 * Registra que o requerimento administrativo (INSS) já foi protocolado e o
 * caso está aguardando resultado — sem isso, "Próxima ação" continuava
 * cobrando "dar entrada" mesmo depois do protocolo já ter sido feito.
 */
export async function registrarProtocoloAdminAction(
  id: string,
  protocolo: string,
  data: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "producao", "editar"))
    return { error: "Sem permissão." };
  // Registra quem é o responsável NESTE momento como "dono" da fase
  // administrativa — se o processo for reatribuído depois (ex: pra alguém
  // tocar o judicial), a comissão do administrativo continua sendo desse
  // colaborador, não de quem assumir depois.
  await sql`
    UPDATE processos
    SET protocolo_inss                = ${protocolo.trim() || null},
        data_protocolo_inss           = ${data || null}::date,
        responsavel_administrativo_id = responsavel_id,
        updated_at                    = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate(id);
  return {};
}

/**
 * Registra que a ação já foi distribuída na justiça e está aguardando
 * resultado — equivalente ao protocolo do INSS, mas para a fase judicial.
 */
export async function registrarDistribuicaoJudicialAction(
  id: string,
  numero: string,
  data: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "producao", "editar"))
    return { error: "Sem permissão." };
  // Mesma lógica do protocolo administrativo: quem é responsável na hora de
  // distribuir a ação fica marcado como dono da fase judicial pra fins de
  // comissão, mesmo que o responsável do processo mude depois disso.
  await sql`
    UPDATE processos
    SET numero                   = COALESCE(NULLIF(${numero.trim()}, ''), numero),
        data_distribuicao        = ${data || null}::date,
        responsavel_judicial_id  = responsavel_id,
        updated_at               = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate(id);
  return {};
}

/**
 * Arquivamento único do processo — usado pelo botão "Arquivar" da Linha de
 * Produção. Atualiza estagio_producao, status e fase_workflow juntos para não
 * deixar o caso "concluído" na Produção mas ainda contando como ativo nos
 * KPIs/listas baseados em status (era a causa dos números não baterem).
 */
export async function arquivarProcessoAction(
  id: string,
  resultado?: string,
  observacao?: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "producao", "editar"))
    return { error: "Sem permissão." };
  const notas = observacao?.trim() || null;
  try {
    await sql`
      UPDATE processos
      SET estagio_producao = 'arquivado',
          status           = 'arquivado',
          fase_workflow    = 'arquivado',
          resultado        = COALESCE(${resultado || null}, resultado),
          notas            = COALESCE(${notas}, notas),
          data_estagio_at  = NOW()
      WHERE id = ${id}::uuid
    `;
    revalidate(id);
    return {};
  } catch {
    return { error: "Erro ao arquivar processo." };
  }
}

// Mapa de retrocesso linear
const PREV_ESTAGIO: Record<string, string> = {
  producao: "analise",
  administrativo: "producao",
  judicial: "administrativo",
};

export async function voltarEstagioAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "producao", "editar")) return;
  const rows =
    await sql`SELECT estagio_producao FROM processos WHERE id = ${id}::uuid`;
  const atual = String(rows[0]?.estagio_producao ?? "");
  const anterior = PREV_ESTAGIO[atual];
  if (!anterior) return;

  await sql`
    UPDATE processos
    SET estagio_producao          = ${anterior},
        resultado_administrativo  = NULL,
        resultado_judicial        = NULL,
        data_estagio_at           = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate(id);
}

export async function reabrirProcessoAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "producao", "editar")) return;
  await sql`
    UPDATE processos
    SET estagio_producao              = 'analise',
        resultado_administrativo      = NULL,
        resultado_judicial            = NULL,
        status                        = 'ativo',
        fase_workflow                 = 'elaboracao',
        resultado                     = NULL,
        responsavel_administrativo_id = NULL,
        responsavel_judicial_id       = NULL,
        data_estagio_at               = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate(id);
}
