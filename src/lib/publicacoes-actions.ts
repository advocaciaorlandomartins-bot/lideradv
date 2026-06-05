"use server";

import sql from "./db";
import { revalidatePath } from "next/cache";

export async function marcarComoTratadaAction(id: number) {
  await sql`
    UPDATE publicacoes
    SET status = 'tratada', updated_at = now()
    WHERE id = ${id}
  `;
  revalidatePath("/dashboard/publicacoes");
}

export async function marcarComoNaoLidaAction(id: number) {
  await sql`
    UPDATE publicacoes
    SET status = 'nao_lida', updated_at = now()
    WHERE id = ${id}
  `;
  revalidatePath("/dashboard/publicacoes");
}

export async function marcarTodasComoTratadasAction() {
  await sql`
    UPDATE publicacoes
    SET status = 'tratada', updated_at = now()
    WHERE status = 'nao_lida'
  `;
  revalidatePath("/dashboard/publicacoes");
}
