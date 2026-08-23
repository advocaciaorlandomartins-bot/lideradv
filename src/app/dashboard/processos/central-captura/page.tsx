import { notFound } from "next/navigation";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import CentralCapturaClient, {
  type ProcessoCaptura,
} from "@/components/dashboard/processos/central-captura-client";

export const dynamic = "force-dynamic";

export default async function CentralCapturaPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) notFound();

  let processos: ProcessoCaptura[] = [];

  try {
    // status_captura antes era sempre "sucesso" fixo, dando a falsa
    // impressão de que a captura automática funcionava pra 100% dos
    // processos (era exatamente esse tipo de bug — sucesso hard-coded sem
    // checar nada de verdade — que escondeu a captura via DJEN nunca
    // tendo funcionado). Agora reflete evidência real: processo sem
    // número CNJ válido não é sequer elegível pra captura automática
    // (DataJud/DJe buscam por número), processo com número válido e
    // alguma publicação já vinculada é considerado funcionando, e
    // processo com número válido mas nenhuma publicação nunca capturada
    // é sinalizado como "erro" pra alguém investigar.
    const rows = (await sql`
      SELECT
        p.id::text,
        COALESCE(p.numero, '') AS processo_numero,
        COALESCE(p.tipo_acao, 'Processo') AS tipo_acao,
        COALESCE(p.status, 'Ativo') AS status,
        p.updated_at,
        COALESCE(c.name, '') AS cliente,
        COALESCE(p.vara, '') AS orgao,
        COUNT(h.id)::int AS movimentacoes,
        (LENGTH(REGEXP_REPLACE(COALESCE(p.numero, ''), '[^0-9]', '', 'g')) = 20) AS numero_valido,
        EXISTS (
          SELECT 1 FROM publicacoes pub WHERE pub.processo = p.numero
        ) AS tem_publicacao
      FROM processos p
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN historico_registros h ON h.processo_id = p.id
      GROUP BY p.id, c.name
      ORDER BY p.updated_at DESC
    `) as Record<string, unknown>[];

    processos = rows.map((r) => {
      const dt = new Date(r.updated_at as string);
      const numeroValido = !!r.numero_valido;
      const temPublicacao = !!r.tem_publicacao;
      const statusCaptura: "sucesso" | "erro" | "desabilitado" = !numeroValido
        ? "desabilitado"
        : temPublicacao
          ? "sucesso"
          : "erro";
      return {
        id: r.id as string,
        processo_numero: r.processo_numero as string,
        tipo_acao: r.tipo_acao as string,
        cliente: r.cliente as string,
        orgao: r.orgao as string,
        ultima_captura: dt.toLocaleDateString("pt-BR"),
        status_captura: statusCaptura,
        movimentacoes: Number(r.movimentacoes) || 0,
        ativo: !["Encerrado", "Arquivado"].includes(r.status as string),
      };
    });
  } catch (e) {
    console.error("Error fetching processos for captura:", e);
  }

  return <CentralCapturaClient processos={processos} />;
}
