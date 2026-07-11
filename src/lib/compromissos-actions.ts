"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import {
  criarCompromisso,
  atualizarCompromisso,
  deletarCompromisso,
} from "./compromissos-db";

interface CompromissoData {
  titulo: string;
  tipo: string;
  dataInicio: string;
  horaInicio: string | null;
  horaFim: string | null;
  localLink: string | null;
  descricao: string | null;
  status?: string;
  clienteId?: string | null;
}

export async function criarCompromissoAction(
  data: CompromissoData
): Promise<{ id: string }> {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");

  const id = await criarCompromisso({ ...data, criadoPor: session.login });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  return { id };
}

export async function atualizarCompromissoAction(
  id: string,
  data: CompromissoData
): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");

  await atualizarCompromisso(id, data);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

export async function deletarCompromissoAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");

  await deletarCompromisso(id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}
