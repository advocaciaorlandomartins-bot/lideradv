import sql from "@/lib/db";
import CentralCapturaClient, {
  type ProcessoCaptura,
} from "@/components/dashboard/processos/central-captura-client";

export const dynamic = "force-dynamic";

export default async function CentralCapturaPage() {
  let processos: ProcessoCaptura[] = [];

  try {
    const rows = (await sql`
      SELECT
        p.id::text,
        COALESCE(p.numero, '') AS processo_numero,
        COALESCE(p.tipo_acao, 'Processo') AS tipo_acao,
        COALESCE(p.status, 'Ativo') AS status,
        p.updated_at,
        COALESCE(c.name, '') AS cliente,
        COALESCE(p.vara, '') AS orgao,
        COUNT(h.id)::int AS movimentacoes
      FROM processos p
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN historico_registros h ON h.processo_id = p.id
      GROUP BY p.id, c.name
      ORDER BY p.updated_at DESC
    `) as Record<string, unknown>[];

    processos = rows.map((r) => {
      const dt = new Date(r.updated_at as string);
      return {
        id: r.id as string,
        processo_numero: r.processo_numero as string,
        tipo_acao: r.tipo_acao as string,
        cliente: r.cliente as string,
        orgao: r.orgao as string,
        ultima_captura: dt.toLocaleDateString("pt-BR"),
        status_captura: "sucesso" as const,
        movimentacoes: Number(r.movimentacoes) || 0,
        ativo: !["Encerrado", "Arquivado"].includes(r.status as string),
      };
    });
  } catch (e) {
    console.error("Error fetching processos for captura:", e);
  }

  return <CentralCapturaClient processos={processos} />;
}
