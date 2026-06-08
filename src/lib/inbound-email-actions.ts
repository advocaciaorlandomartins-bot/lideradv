"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";
import { logAction } from "./audit";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import {
  getAddressByClientId,
  createAddressForClient,
  markEmailAsRead,
  setupInboundEmailTables,
} from "./inbound-emails-db";

export type InboundEmailState = { error: string } | { ok: true } | null;

// ── Gerar endereço exclusivo para cliente ──────────────────────────────────────

export async function gerarEnderecoAction(
  clientId: string
): Promise<InboundEmailState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "editar"))
    return { error: "Sem permissão para gerar e-mail exclusivo." };

  // Buscar nome do cliente
  const rows = await sql`
    SELECT name FROM clients WHERE id = ${clientId}::uuid LIMIT 1
  `;
  if (!rows[0]) return { error: "Cliente não encontrado." };

  // Verificar se já tem endereço ativo
  const existing = await getAddressByClientId(clientId);
  if (existing) return { error: "Este cliente já possui um e-mail exclusivo." };

  try {
    const addr = await createAddressForClient(clientId, rows[0].name as string);
    await logAction({
      acao: "criar",
      entidade: "inbound_email",
      descricao: `Gerou e-mail exclusivo ${addr.address} para cliente`,
    });
    revalidatePath(`/dashboard/clientes/${clientId}`);
    return { ok: true };
  } catch {
    return { error: "Erro ao gerar endereço de e-mail. Tente novamente." };
  }
}

// ── Marcar e-mail como lido ────────────────────────────────────────────────────

export async function marcarLidoAction(
  emailId: string,
  clientId: string
): Promise<InboundEmailState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver"))
    return { error: "Sem permissão." };

  try {
    await markEmailAsRead(emailId);
    revalidatePath(`/dashboard/clientes/${clientId}`);
    return { ok: true };
  } catch {
    return { error: "Erro ao marcar como lido." };
  }
}

// ── Criar tabelas (idempotente, chamado em setup) ─────────────────────────────

export async function setupAction(): Promise<InboundEmailState> {
  const session = await getSession();
  if (!session || session.categoria !== "admin")
    return { error: "Apenas admins podem executar setup." };

  try {
    await setupInboundEmailTables();
    return { ok: true };
  } catch {
    return { error: "Erro ao criar tabelas." };
  }
}
