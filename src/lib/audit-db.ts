import sql from "./db";

export interface AuditLog {
  id: string;
  user_login: string;
  user_cat: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  descricao: string | null;
  detalhes: Record<string, unknown> | null;
  created_at_fmt: string; // "DD/MM/YYYY HH24:MI" Brazil time
}

export interface AuditFilters {
  userLogin?: string;
  acao?: string;
  entidade?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const ALLOWED_PAGE_SIZES = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 20;

export async function getAuditLogs(f: AuditFilters = {}): Promise<{
  logs: AuditLog[];
  total: number;
  totalPages: number;
  distinctUsers: string[];
  pageSize: number;
}> {
  const page = f.page ?? 1;
  const pageSize = ALLOWED_PAGE_SIZES.includes(
    f.pageSize as (typeof ALLOWED_PAGE_SIZES)[number]
  )
    ? f.pageSize!
    : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const userLogin = f.userLogin || null;
  const acao = f.acao || null;
  const entidade = f.entidade || null;
  const dateFrom = f.dateFrom || null;
  const dateTo = f.dateTo || null;
  const search = f.search || null;

  try {
    const [rows, countRows, userRows] = await Promise.all([
      sql`
        SELECT
          id::text,
          user_login,
          user_cat,
          acao,
          entidade,
          entidade_id,
          descricao,
          detalhes,
          to_char(
            created_at AT TIME ZONE 'America/Sao_Paulo',
            'DD/MM/YYYY HH24:MI'
          ) AS created_at_fmt
        FROM audit_logs
        WHERE
          (${userLogin}::text IS NULL OR user_login = ${userLogin})
          AND (${acao}::text IS NULL OR acao = ${acao})
          AND (${entidade}::text IS NULL OR entidade = ${entidade})
          AND (${dateFrom}::text IS NULL
               OR created_at AT TIME ZONE 'America/Sao_Paulo' >= ${dateFrom}::date)
          AND (${dateTo}::text IS NULL
               OR created_at AT TIME ZONE 'America/Sao_Paulo' < (${dateTo}::date + INTERVAL '1 day'))
          AND (${search}::text IS NULL
               OR descricao ILIKE '%' || ${search} || '%')
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS total
        FROM audit_logs
        WHERE
          (${userLogin}::text IS NULL OR user_login = ${userLogin})
          AND (${acao}::text IS NULL OR acao = ${acao})
          AND (${entidade}::text IS NULL OR entidade = ${entidade})
          AND (${dateFrom}::text IS NULL
               OR created_at AT TIME ZONE 'America/Sao_Paulo' >= ${dateFrom}::date)
          AND (${dateTo}::text IS NULL
               OR created_at AT TIME ZONE 'America/Sao_Paulo' < (${dateTo}::date + INTERVAL '1 day'))
          AND (${search}::text IS NULL
               OR descricao ILIKE '%' || ${search} || '%')
      `,
      sql`
        SELECT DISTINCT user_login
        FROM audit_logs
        ORDER BY user_login
      `,
    ]);

    const total = (countRows[0]?.total as number) ?? 0;
    return {
      logs: rows as AuditLog[],
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      distinctUsers: userRows.map((r) => r.user_login as string),
      pageSize,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Table doesn't exist yet (no log has been created)
    if (msg.includes("audit_logs")) {
      return {
        logs: [],
        total: 0,
        totalPages: 1,
        distinctUsers: [],
        pageSize: DEFAULT_PAGE_SIZE,
      };
    }
    throw err;
  }
}

// Action labels used across UI
export const ACAO_META: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "blue" },
  logout: { label: "Logout", color: "slate" },
  criar: { label: "Criou", color: "emerald" },
  editar: { label: "Editou", color: "amber" },
  excluir: { label: "Excluiu", color: "red" },
  pagar: { label: "Pagou", color: "cyan" },
  reverter: { label: "Reverteu", color: "orange" },
};

export const ENTIDADE_META: Record<string, string> = {
  usuario: "Usuário",
  cliente: "Cliente",
  processo: "Processo",
  lancamento: "Lançamento",
  colaborador: "Colaborador",
  remuneracao: "Remuneração",
  controle: "Controle",
  compromisso: "Compromisso",
};
