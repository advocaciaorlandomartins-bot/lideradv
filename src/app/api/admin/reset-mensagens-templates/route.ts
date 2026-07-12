import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getMensagensConfig,
  saveMensagensConfig,
} from "@/lib/mensagens-config-db";
import { MENSAGENS_PADROES } from "@/config/mensagens";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/reset-mensagens-templates
 * Resets only the text templates (not intervals) to the current defaults.
 * Requires admin session.
 */
export async function POST() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.categoria !== "Administrador(a)") {
    return NextResponse.json(
      { error: "Requer perfil Administrador(a)." },
      { status: 403 }
    );
  }

  const current = await getMensagensConfig();

  // Preserve intervals, reset only text templates
  await saveMensagensConfig({
    inss_lembrete1: MENSAGENS_PADROES.inss_lembrete1,
    inss_lembrete2: MENSAGENS_PADROES.inss_lembrete2,
    inss_lembrete3: MENSAGENS_PADROES.inss_lembrete3,
    inss_vespera_manha: MENSAGENS_PADROES.inss_vespera_manha,
    inss_vespera_tarde: MENSAGENS_PADROES.inss_vespera_tarde,
    videochamada_convite: MENSAGENS_PADROES.videochamada_convite,
    videochamada_vespera: MENSAGENS_PADROES.videochamada_vespera,
    videochamada_dia: MENSAGENS_PADROES.videochamada_dia,
    wpp_call_convite: MENSAGENS_PADROES.wpp_call_convite,
    wpp_call_vespera: MENSAGENS_PADROES.wpp_call_vespera,
    wpp_call_dia: MENSAGENS_PADROES.wpp_call_dia,
    honorario_lembrete1: MENSAGENS_PADROES.honorario_lembrete1,
    honorario_lembrete2: MENSAGENS_PADROES.honorario_lembrete2,
    honorario_lembrete3: MENSAGENS_PADROES.honorario_lembrete3,
    honorario_vence_hoje: MENSAGENS_PADROES.honorario_vence_hoje,
    honorario_pagamento_quitado: MENSAGENS_PADROES.honorario_pagamento_quitado,
    honorario_pagamento_parcial: MENSAGENS_PADROES.honorario_pagamento_parcial,
  });

  return NextResponse.json({
    ok: true,
    mensagem: "Templates de mensagens atualizados com sucesso.",
    intervalos_preservados: {
      inss_lembrete1_dias: current.inss_lembrete1_dias,
      inss_lembrete2_dias: current.inss_lembrete2_dias,
      inss_lembrete3_dias: current.inss_lembrete3_dias,
    },
  });
}
