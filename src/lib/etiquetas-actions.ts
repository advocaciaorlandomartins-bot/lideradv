"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { podeEditarProcesso } from "./processo-ownership";
import { logAction } from "./audit";
import {
  getEtiquetaPorCategoriaValor,
  criarOuObterEtiqueta,
  aplicarEtiquetaCliente,
  removerEtiquetaCliente,
  aplicarEtiquetaProcesso,
  removerEtiquetaProcesso,
} from "./etiquetas-db";
import {
  CORES_ETIQUETA,
  formatarEtiqueta,
  type Etiqueta,
  type EscopoEtiqueta,
} from "./etiquetas-types";

export type EtiquetaFormState = { error?: string; success?: boolean } | null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Z0-9_]{1,60}$/;

const DIACRITICOS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizarToken(v: string): string {
  return v
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(DIACRITICOS_RE, "") // remove acentos (marcas de combinação após NFD)
    .replace(/\s+/g, "_");
}

/**
 * Resolve categoria:valor pra uma etiqueta existente, ou cria uma nova —
 * criar categoria/valor nunca vistos exige configuracoes:editar (admin);
 * aplicar uma etiqueta já existente no catálogo não exige (a permissão de
 * editar cliente/processo já cobre isso, verificada por quem chama).
 */
async function resolverOuCriarEtiqueta(params: {
  categoria: string;
  valor: string;
  cor?: string;
  escopo?: EscopoEtiqueta;
}): Promise<{ etiqueta?: Etiqueta; error?: string }> {
  const categoria = normalizarToken(params.categoria);
  const valor = normalizarToken(params.valor);
  if (!TOKEN_RE.test(categoria) || !TOKEN_RE.test(valor)) {
    return {
      error:
        "Categoria/valor inválidos — use letras, números e _ (sem espaço ou acento).",
    };
  }

  const existente = await getEtiquetaPorCategoriaValor(categoria, valor);
  if (existente) return { etiqueta: existente };

  const session = await getSession();
  if (!session || !hasPermission(session, "configuracoes", "editar")) {
    return {
      error: `A etiqueta "${categoria}:${valor}" ainda não existe no catálogo — só administradores podem criar uma etiqueta nova. Use uma já existente ou peça pra um admin criar.`,
    };
  }

  const cor = (CORES_ETIQUETA as readonly string[]).includes(params.cor ?? "")
    ? params.cor!
    : "slate";
  const escopo = params.escopo ?? "ambos";
  const etiqueta = await criarOuObterEtiqueta(categoria, valor, cor, escopo);
  return { etiqueta };
}

export async function aplicarEtiquetaClienteAction(
  clienteId: string,
  categoria: string,
  valor: string,
  cor?: string,
  escopo?: EscopoEtiqueta
): Promise<EtiquetaFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "editar"))
    return { error: "Sem permissão." };
  if (!UUID_RE.test(clienteId)) return { error: "Cliente inválido." };

  const resolved = await resolverOuCriarEtiqueta({
    categoria,
    valor,
    cor,
    escopo,
  });
  if (resolved.error || !resolved.etiqueta) return { error: resolved.error };

  await aplicarEtiquetaCliente(resolved.etiqueta.id, clienteId);
  await logAction({
    acao: "editar",
    entidade: "cliente",
    entidadeId: clienteId,
    descricao: `Etiqueta ${formatarEtiqueta(resolved.etiqueta)} aplicada`,
  });
  revalidatePath(`/dashboard/clientes/${clienteId}`);
  revalidatePath("/dashboard/clientes");
  revalidatePath("/dashboard/processos");
  return { success: true };
}

export async function removerEtiquetaClienteAction(
  clienteId: string,
  etiquetaId: string
): Promise<EtiquetaFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "editar"))
    return { error: "Sem permissão." };
  if (!UUID_RE.test(clienteId) || !UUID_RE.test(etiquetaId))
    return { error: "ID inválido." };

  await removerEtiquetaCliente(etiquetaId, clienteId);
  revalidatePath(`/dashboard/clientes/${clienteId}`);
  revalidatePath("/dashboard/clientes");
  revalidatePath("/dashboard/processos");
  return { success: true };
}

export async function aplicarEtiquetaProcessoAction(
  processoId: string,
  categoria: string,
  valor: string,
  cor?: string,
  escopo?: EscopoEtiqueta
): Promise<EtiquetaFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "editar"))
    return { error: "Sem permissão." };
  if (!UUID_RE.test(processoId)) return { error: "Processo inválido." };
  if (!(await podeEditarProcesso(session, processoId)))
    return { error: "Sem permissão." };

  const resolved = await resolverOuCriarEtiqueta({
    categoria,
    valor,
    cor,
    escopo,
  });
  if (resolved.error || !resolved.etiqueta) return { error: resolved.error };

  await aplicarEtiquetaProcesso(resolved.etiqueta.id, processoId);
  await logAction({
    acao: "editar",
    entidade: "processo",
    entidadeId: processoId,
    descricao: `Etiqueta ${formatarEtiqueta(resolved.etiqueta)} aplicada`,
  });
  revalidatePath(`/dashboard/processos/${processoId}`);
  revalidatePath("/dashboard/processos");
  return { success: true };
}

export async function removerEtiquetaProcessoAction(
  processoId: string,
  etiquetaId: string
): Promise<EtiquetaFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "editar"))
    return { error: "Sem permissão." };
  if (!UUID_RE.test(processoId) || !UUID_RE.test(etiquetaId))
    return { error: "ID inválido." };
  if (!(await podeEditarProcesso(session, processoId)))
    return { error: "Sem permissão." };

  await removerEtiquetaProcesso(etiquetaId, processoId);
  revalidatePath(`/dashboard/processos/${processoId}`);
  revalidatePath("/dashboard/processos");
  return { success: true };
}
