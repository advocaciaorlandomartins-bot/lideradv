import { notFound } from "next/navigation";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import AndamentosClient, {
  type AndamentoDisplay,
} from "@/components/dashboard/processos/andamentos-client";

export const dynamic = "force-dynamic";

export default async function AndamentosPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) notFound();

  // Sem "processos_ver_todos": restringe aos andamentos de processos onde o
  // usuário é responsável — mesma regra já aplicada em
  // dashboard/processos/page.tsx. Sem isso, qualquer advogado(a) via
  // Andamentos lia texto de histórico de TODOS os processos do escritório,
  // não só os próprios (getAllProcessos já tinha essa trava, esta tela não).
  const verTodos = hasPermission(session, "processos_ver_todos", "ver");
  const colaboradorId = verTodos
    ? null
    : await getColaboradorIdForUser(session.id);

  let andamentos: AndamentoDisplay[] = [];

  try {
    const rows = (await sql`
      SELECT
        h.id::text,
        COALESCE(h.texto, '') AS texto,
        COALESCE(h.tipo, 'Registro') AS tipo,
        h.lido_em,
        h.created_at,
        COALESCE(p.numero, '') AS processo_numero,
        COALESCE(p.tipo_acao, '') AS tipo_acao,
        COALESCE(c.name, '') AS cliente,
        COALESCE(p.vara, '') AS orgao
      FROM historico_registros h
      LEFT JOIN processos p ON p.id = h.processo_id
      LEFT JOIN clients c ON c.id = COALESCE(h.client_id, p.client_id)
      WHERE ${verTodos} OR p.responsavel_id = ${colaboradorId}::uuid
      ORDER BY h.created_at DESC
      LIMIT 100
    `) as Record<string, unknown>[];

    const now = new Date();
    andamentos = rows.map((r) => {
      const dt = new Date(r.created_at as string);
      const isToday =
        dt.getDate() === now.getDate() &&
        dt.getMonth() === now.getMonth() &&
        dt.getFullYear() === now.getFullYear();
      return {
        id: r.id as string,
        data: dt.toLocaleDateString("pt-BR"),
        hora: dt.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        processo_numero: r.processo_numero as string,
        tipo_acao: r.tipo_acao as string,
        cliente: r.cliente as string,
        descricao: r.texto as string,
        tipo_andamento: r.tipo as string,
        orgao: r.orgao as string,
        responsavel: "",
        lido: r.lido_em != null,
        hoje: isToday,
      };
    });
  } catch (e) {
    console.error("Error fetching andamentos:", e);
  }

  return <AndamentosClient andamentos={andamentos} />;
}
