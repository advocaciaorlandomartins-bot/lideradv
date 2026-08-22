/**
 * POST /api/dados/anonimizar
 * Body: { cliente_id: string, motivo: string }
 *
 * Anonimiza (não apaga) os dados pessoais identificáveis de um cliente,
 * preservando registros históricos de negócio sem PII — art. 18, IV LGPD.
 * Requer perfil Administrador.
 *
 * O que é anonimizado:
 *   - nome → "[ANONIMIZADO]"
 *   - doc (CPF/CNPJ), rg, email, phone → ""
 *   - endereço → todos os campos em branco
 *   - birth_date, filiacao_*, naturalidade_* → NULL
 *   - notes → NULL
 *   - dados previdenciários de saúde (CID, diagnóstico, etc.) → NULL
 *
 * O que é preservado:
 *   - id, tipo, status, área (para fins legais / contábeis)
 *   - processos e lançamentos (preservados por obrigação legal)
 *   - e-mails recebidos → body_text e body_html anonimizados
 */
import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.categoria !== "Administrador(a)") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  let body: { cliente_id?: string; motivo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const clienteId = (body.cliente_id ?? "").trim();
  const motivo = (body.motivo ?? "Solicitação LGPD").trim();
  if (!clienteId || !UUID_RE.test(clienteId)) {
    return NextResponse.json(
      { error: "Campo cliente_id inválido." },
      { status: 422 }
    );
  }

  try {
    // Verifica se existe
    const existe = await sql`
      SELECT id FROM clients WHERE id = ${clienteId}::uuid LIMIT 1
    `;
    if (existe.length === 0) {
      return NextResponse.json(
        { error: "Cliente não encontrado." },
        { status: 404 }
      );
    }

    // 1. Anonimiza dados pessoais do cliente
    // Nomes de coluna corrigidos — a versão anterior usava
    // nome_responsavel/cpf_responsavel/etc. (colunas que não existem; o
    // schema real é responsavel_nome/responsavel_cpf/etc., confirmado em
    // clients-db.ts), então o UPDATE inteiro falhava (erro 42703 do
    // Postgres) e caía sempre no catch — a anonimização nunca funcionou
    // desde que foi escrita. Também não define mais deleted_at: o próprio
    // objetivo documentado aqui é preservar processos/lançamentos ligados
    // ao cliente por obrigação legal, mas soft-deletar o cliente o fazia
    // sumir de toda consulta (getClientFull/getAllClients filtram por
    // deleted_at IS NULL), órfãos exatamente do jeito que o comentário
    // dizia que não devia acontecer.
    await sql`
      UPDATE clients SET
        name                    = '[ANONIMIZADO]',
        trade_name              = NULL,
        doc                     = '',
        email                   = '',
        phone                   = '',
        rg                      = NULL,
        rg_orgao                = NULL,
        cep                     = '',
        street                  = '',
        addr_number             = '',
        complement              = NULL,
        neighborhood            = '',
        city                    = '',
        state                   = '',
        birth_date              = NULL,
        estado_civil            = NULL,
        genero                  = NULL,
        profissao               = NULL,
        nacionalidade           = NULL,
        naturalidade_cidade     = NULL,
        naturalidade_estado     = NULL,
        filiacao_mae            = NULL,
        filiacao_pai            = NULL,
        nis                     = NULL,
        num_beneficio           = NULL,
        cid_principal           = NULL,
        tipo_incapacidade       = NULL,
        data_diagnostico        = NULL,
        data_afastamento        = NULL,
        atividade_anterior      = NULL,
        senha_cliente           = NULL,
        senha_inss              = NULL,
        responsavel_nome        = NULL,
        responsavel_cpf         = NULL,
        responsavel_rg          = NULL,
        responsavel_rg_orgao    = NULL,
        responsavel_telefone    = NULL,
        responsavel_email       = NULL,
        responsavel_parentesco  = NULL,
        notes                   = NULL
      WHERE id = ${clienteId}::uuid
    `;

    // 2. Anonimiza corpo de e-mails vinculados
    await sql`
      UPDATE inbound_emails SET
        from_name   = '[ANONIMIZADO]',
        from_address = 'anonimizado@removido.lgpd',
        body_text   = '[Conteúdo removido a pedido do titular — LGPD art. 18]',
        body_html   = '<p>[Conteúdo removido a pedido do titular — LGPD art. 18]</p>',
        ai_summary  = NULL
      WHERE client_id = ${clienteId}::uuid
    `;

    // 3. Registra solicitação LGPD
    await sql`
      INSERT INTO lgpd_solicitacoes
        (tipo, entidade, entidade_id, motivo, executado_por, executado_em)
      VALUES
        ('anonimizacao', 'cliente', ${clienteId}, ${motivo},
         ${session.login}, NOW())
    `;

    await logAction({
      acao: "anonimizar_lgpd",
      entidade: "cliente",
      entidadeId: clienteId,
      descricao: `Anonimização LGPD executada. Motivo: ${motivo}`,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Dados pessoais anonimizados. Registros de negócio preservados conforme obrigação legal.",
      cliente_id: clienteId,
      executado_em: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[lgpd/anonimizar]", err);
    return NextResponse.json(
      { error: "Erro ao anonimizar dados." },
      { status: 500 }
    );
  }
}
