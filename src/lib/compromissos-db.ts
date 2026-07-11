import sql from "./db";

export interface Compromisso {
  id: string;
  titulo: string;
  tipo: "reuniao" | "videochamada" | "fechamento" | "consulta" | "outro";
  data_inicio: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  local_link: string | null;
  descricao: string | null;
  cor: string;
  status: "pendente" | "concluido";
  criado_por: string;
  criado_em: string;
}

export const TIPO_LABELS_COMP: Record<string, string> = {
  reuniao: "Reunião",
  videochamada: "Videochamada",
  fechamento: "Fechamento",
  consulta: "Consulta",
  outro: "Outro",
};

export const TIPO_ICONS_COMP: Record<string, string> = {
  reuniao: "🤝",
  videochamada: "📹",
  fechamento: "✍️",
  consulta: "👥",
  outro: "📌",
};

function toDateStr(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function mapRow(r: Record<string, unknown>): Compromisso {
  return {
    id: String(r.id),
    titulo: String(r.titulo),
    tipo: String(r.tipo) as Compromisso["tipo"],
    data_inicio: toDateStr(r.data_inicio),
    hora_inicio: r.hora_inicio ? String(r.hora_inicio).slice(0, 5) : null,
    hora_fim: r.hora_fim ? String(r.hora_fim).slice(0, 5) : null,
    local_link: r.local_link ? String(r.local_link) : null,
    descricao: r.descricao ? String(r.descricao) : null,
    cor: String(r.cor),
    status: (String(r.status) as Compromisso["status"]) ?? "pendente",
    criado_por: String(r.criado_por),
    criado_em: String(r.criado_em),
  };
}

export async function listarCompromissosPeriodo(
  criadoPor: string,
  startDate: string,
  endDate: string
): Promise<Compromisso[]> {
  const rows = await sql`
    SELECT * FROM compromissos
    WHERE criado_por = ${criadoPor}
      AND data_inicio >= ${startDate}::date
      AND data_inicio <  ${endDate}::date
    ORDER BY data_inicio, hora_inicio NULLS LAST
  `;
  return rows.map(mapRow);
}

export async function listarCompromissosProximos(
  criadoPor: string,
  dias = 14
): Promise<Compromisso[]> {
  const rows = await sql`
    SELECT * FROM compromissos
    WHERE criado_por  = ${criadoPor}
      AND status      = 'pendente'
      AND data_inicio >= CURRENT_DATE
      AND data_inicio <= CURRENT_DATE + (${dias} || ' days')::interval
    ORDER BY data_inicio, hora_inicio NULLS LAST
    LIMIT 20
  `;
  return rows.map(mapRow);
}

export async function criarCompromisso(data: {
  titulo: string;
  tipo: string;
  dataInicio: string;
  horaInicio: string | null;
  horaFim: string | null;
  localLink: string | null;
  descricao: string | null;
  cor?: string;
  criadoPor: string;
  clienteId?: string | null;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO compromissos
      (titulo, tipo, data_inicio, hora_inicio, hora_fim, local_link, descricao, cor, criado_por, cliente_id)
    VALUES (
      ${data.titulo},
      ${data.tipo},
      ${data.dataInicio}::date,
      ${data.horaInicio || null},
      ${data.horaFim || null},
      ${data.localLink || null},
      ${data.descricao || null},
      ${data.cor ?? "#0ea5e9"},
      ${data.criadoPor},
      ${data.clienteId ? sql`${data.clienteId}::uuid` : sql`NULL`}
    )
    RETURNING id::text
  `;
  return String(rows[0].id);
}

export async function atualizarCompromisso(
  id: string,
  data: {
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
): Promise<void> {
  await sql`
    UPDATE compromissos
    SET
      titulo        = ${data.titulo},
      tipo          = ${data.tipo},
      data_inicio   = ${data.dataInicio}::date,
      hora_inicio   = ${data.horaInicio},
      hora_fim      = ${data.horaFim},
      local_link    = ${data.localLink},
      descricao     = ${data.descricao},
      status        = ${data.status ?? "pendente"},
      cliente_id    = ${data.clienteId ? sql`${data.clienteId}::uuid` : sql`NULL`},
      atualizado_em = NOW()
    WHERE id = ${id}::uuid
  `;
}

export async function deletarCompromisso(id: string): Promise<void> {
  await sql`DELETE FROM compromissos WHERE id = ${id}::uuid`;
}
