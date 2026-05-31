"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";

function revalidate() {
  revalidatePath("/dashboard/producao");
  revalidatePath("/dashboard/processos");
}

export async function moverParaProducaoAction(id: string): Promise<void> {
  await sql`
    UPDATE processos
    SET estagio_producao = 'producao', data_estagio_at = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate();
}

export async function moverParaAdministrativoAction(id: string): Promise<void> {
  await sql`
    UPDATE processos
    SET estagio_producao = 'administrativo', data_estagio_at = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate();
}

export async function registrarResultadoAdminAction(
  id: string,
  resultado: "concedido" | "negado",
  proximoEstagio: "judicial" | "arquivado"
): Promise<void> {
  await sql`
    UPDATE processos
    SET resultado_administrativo = ${resultado},
        estagio_producao         = ${proximoEstagio},
        data_estagio_at          = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate();
}

export async function registrarResultadoJudicialAction(
  id: string,
  resultado: "procedente" | "improcedente" | "parcial"
): Promise<void> {
  await sql`
    UPDATE processos
    SET resultado_judicial = ${resultado},
        estagio_producao   = 'arquivado',
        data_estagio_at    = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate();
}

export async function arquivarProcessoAction(id: string): Promise<void> {
  await sql`
    UPDATE processos
    SET estagio_producao = 'arquivado', data_estagio_at = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate();
}

// Mapa de retrocesso linear
const PREV_ESTAGIO: Record<string, string> = {
  producao: "analise",
  administrativo: "producao",
  judicial: "administrativo",
};

export async function voltarEstagioAction(id: string): Promise<void> {
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
  revalidate();
}

export async function reabrirProcessoAction(id: string): Promise<void> {
  await sql`
    UPDATE processos
    SET estagio_producao          = 'analise',
        resultado_administrativo  = NULL,
        resultado_judicial        = NULL,
        data_estagio_at           = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidate();
}
