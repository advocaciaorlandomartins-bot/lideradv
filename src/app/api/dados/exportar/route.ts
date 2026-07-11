/**
 * GET /api/dados/exportar?cliente_id=<uuid>
 * Portabilidade de dados — art. 20 LGPD.
 * Requer perfil Administrador ou Sócio.
 * Retorna todos os dados pessoais do cliente em JSON estruturado.
 */
import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  const isAdminOrSocio =
    session?.categoria === "Administrador(a)" ||
    session?.categoria === "Sócio(a)";
  if (!session || !isAdminOrSocio) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const { searchParams } = new URL(req.url);
  const clienteId = (searchParams.get("cliente_id") ?? "").trim();
  if (!clienteId || !UUID_RE.test(clienteId)) {
    return NextResponse.json(
      { error: "Parâmetro cliente_id inválido." },
      { status: 400 }
    );
  }

  try {
    const [clientes, processos, lancamentos, emails, documentos] =
      await Promise.allSettled([
        sql`
          SELECT
            id::text, type, name, doc, email, phone,
            cep, street, addr_number, complement, neighborhood, city, state,
            birth_date, rg, rg_orgao, estado_civil, genero, profissao,
            nacionalidade, naturalidade_cidade, naturalidade_estado,
            filiacao_mae, filiacao_pai,
            nis, num_beneficio, status_beneficio, tipo_beneficio, valor_beneficio,
            cid_principal, tipo_incapacidade, data_diagnostico, data_afastamento,
            notes, status, created_at, updated_at
          FROM clients
          WHERE id = ${clienteId}::uuid AND deleted_at IS NULL
        `,
        sql`
          SELECT
            id::text, numero, tipo_acao, area, fase, vara, comarca,
            parte_contraria, valor_causa, data_distribuicao,
            protocolo_inss, resultado_admin, status,
            created_at, updated_at
          FROM processos
          WHERE client_id = ${clienteId}::uuid AND deleted_at IS NULL
          ORDER BY created_at DESC
        `,
        sql`
          SELECT
            id::text, tipo, descricao, valor, data_vencimento,
            data_pagamento, status, created_at
          FROM lancamentos
          WHERE client_id = ${clienteId}::uuid
          ORDER BY created_at DESC
          LIMIT 500
        `,
        sql`
          SELECT
            id::text, subject, from_address, from_name,
            received_at, ai_summary
          FROM inbound_emails
          WHERE client_id = ${clienteId}::uuid
          ORDER BY received_at DESC
          LIMIT 200
        `,
        sql`
          SELECT
            id::text, nome, tipo, criado_em
          FROM documentos
          WHERE client_id = ${clienteId}::uuid
          ORDER BY criado_em DESC
          LIMIT 200
        `,
      ]);

    const cliente =
      clientes.status === "fulfilled" && clientes.value.length > 0
        ? clientes.value[0]
        : null;

    if (!cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }

    await logAction({
      acao: "exportar_lgpd",
      entidade: "cliente",
      entidadeId: clienteId,
      descricao: `Exportação LGPD dos dados do cliente`,
    });

    return NextResponse.json(
      {
        exportado_em: new Date().toISOString(),
        solicitado_por: session.login,
        base_legal: "Art. 20 LGPD — Direito à portabilidade",
        dados: {
          cliente,
          processos: processos.status === "fulfilled" ? processos.value : [],
          lancamentos:
            lancamentos.status === "fulfilled" ? lancamentos.value : [],
          emails_recebidos: emails.status === "fulfilled" ? emails.value : [],
          documentos: documentos.status === "fulfilled" ? documentos.value : [],
        },
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="lgpd-export-${clienteId}.json"`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("[lgpd/exportar]", err);
    return NextResponse.json(
      { error: "Erro ao exportar dados." },
      { status: 500 }
    );
  }
}
