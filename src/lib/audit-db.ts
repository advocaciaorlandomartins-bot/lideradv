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

export interface StatusEquipeRow {
  id: string;
  nome: string;
  login: string;
  categoria: string;
  online: boolean;
  ultimoLogin: string | null;
  ultimoLogout: string | null;
  ultimaAtividade: string | null;
}

// "Online" é sempre aproximado — não existe evento de "fechei a aba sem
// clicar em Sair" pra avisar o servidor. Define-se por: teve login mais
// recente que qualquer logout registrado, E teve atividade (ultimo_acesso,
// atualizado a cada requisição via session.ts) dentro desta janela.
const JANELA_ONLINE_MS = 5 * 60_000;

/** Status de presença de cada usuário ativo — pra tela de Auditoria. Usa
 * login/logout já registrados em audit_logs (nenhuma tabela nova) +
 * usuarios.ultimo_acesso (agora atualizado a cada requisição, não só no
 * login — ver session.ts). */
export async function getStatusEquipe(): Promise<StatusEquipeRow[]> {
  try {
    const rows = await sql`
      SELECT
        u.id::text, u.nome, u.login, u.categoria,
        u.ultimo_acesso::text AS ultima_atividade,
        (
          SELECT created_at FROM audit_logs
          WHERE acao = 'login' AND user_login = u.login
          ORDER BY created_at DESC LIMIT 1
        ) AS ultimo_login,
        (
          SELECT created_at FROM audit_logs
          WHERE acao = 'logout' AND user_login = u.login
          ORDER BY created_at DESC LIMIT 1
        ) AS ultimo_logout
      FROM usuarios u
      WHERE u.ativo = true
      ORDER BY u.nome
    `;

    const agora = Date.now();
    return rows.map((r) => {
      const ultimoLogin = r.ultimo_login ? new Date(r.ultimo_login) : null;
      const ultimoLogout = r.ultimo_logout ? new Date(r.ultimo_logout) : null;
      const ultimaAtividade = r.ultima_atividade
        ? new Date(r.ultima_atividade)
        : null;

      // deslogou depois do último login = sessão fechada de propósito
      const deslogouDepois =
        ultimoLogin && ultimoLogout && ultimoLogout > ultimoLogin;

      const online =
        !!ultimoLogin &&
        !deslogouDepois &&
        !!ultimaAtividade &&
        agora - ultimaAtividade.getTime() < JANELA_ONLINE_MS;

      return {
        id: r.id,
        nome: r.nome,
        login: r.login,
        categoria: r.categoria,
        online,
        ultimoLogin: ultimoLogin?.toISOString() ?? null,
        // só mostra "saiu" quando o logout registrado é mesmo depois do
        // login mais recente — senão seria o logout de uma sessão anterior
        ultimoLogout: deslogouDepois ? ultimoLogout!.toISOString() : null,
        ultimaAtividade: ultimaAtividade?.toISOString() ?? null,
      };
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("audit_logs")) return [];
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
