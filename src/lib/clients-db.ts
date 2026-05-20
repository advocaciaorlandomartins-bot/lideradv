import sql from "./db";

export interface Client {
  id: string;
  type: "PF" | "PJ";
  name: string;
  doc: string;
  trade_name: string | null;
  email: string;
  phone: string;
  city: string;
  state: string;
  status: "ativo" | "inativo";
  since: string;
  lastContact: string;
  processes: number;
}

function formatSince(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR");
}

export async function getAllClients(): Promise<Client[]> {
  const rows = await sql`
    SELECT
      c.id::text,
      c.type,
      c.name,
      c.doc,
      c.trade_name,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.status,
      c.created_at,
      (SELECT COUNT(*)::int FROM processos WHERE client_id = c.id) AS process_count
    FROM clients c
    ORDER BY c.created_at DESC
  `;

  return rows.map((r) => ({
    id: r.id,
    type: r.type as "PF" | "PJ",
    name: r.name,
    doc: r.doc,
    trade_name: r.trade_name ?? null,
    email: r.email,
    phone: r.phone,
    city: r.city,
    state: r.state,
    status: r.status as "ativo" | "inativo",
    since: formatSince(new Date(r.created_at)),
    lastContact: formatDate(new Date(r.created_at)),
    processes: r.process_count ?? 0,
  }));
}

export interface ClientFull {
  id: string;
  type: "PF" | "PJ";
  name: string;
  doc: string;
  trade_name: string | null;
  birth_date: string | null;
  email: string;
  phone: string;
  cep: string;
  street: string;
  addr_number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  notes: string | null;
  status: "ativo" | "inativo";
  since: string;
  lastContact: string;
  processes: number;
}

export async function getClientFull(id: string): Promise<ClientFull | null> {
  const rows = await sql`
    SELECT
      c.id::text,
      c.type, c.name, c.doc, c.trade_name,
      to_char(c.birth_date, 'YYYY-MM-DD') AS birth_date,
      c.email, c.phone, c.cep, c.street, c.addr_number, c.complement,
      c.neighborhood, c.city, c.state, c.notes, c.status, c.created_at,
      (SELECT COUNT(*)::int FROM processos WHERE client_id = c.id) AS process_count
    FROM clients c
    WHERE c.id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    type: r.type as "PF" | "PJ",
    name: r.name,
    doc: r.doc,
    trade_name: r.trade_name ?? null,
    birth_date: r.birth_date ?? null,
    email: r.email,
    phone: r.phone,
    cep: r.cep,
    street: r.street,
    addr_number: r.addr_number,
    complement: r.complement ?? null,
    neighborhood: r.neighborhood,
    city: r.city,
    state: r.state,
    notes: r.notes ?? null,
    status: r.status as "ativo" | "inativo",
    since: formatSince(new Date(r.created_at)),
    lastContact: formatDate(new Date(r.created_at)),
    processes: r.process_count ?? 0,
  };
}

export async function getClientById(id: string): Promise<Client | null> {
  const rows = await sql`
    SELECT
      c.id::text,
      c.type,
      c.name,
      c.doc,
      c.trade_name,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.status,
      c.created_at,
      (SELECT COUNT(*)::int FROM processos WHERE client_id = c.id) AS process_count
    FROM clients c
    WHERE c.id = ${id}::uuid
  `;

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    type: r.type as "PF" | "PJ",
    name: r.name,
    doc: r.doc,
    trade_name: r.trade_name ?? null,
    email: r.email,
    phone: r.phone,
    city: r.city,
    state: r.state,
    status: r.status as "ativo" | "inativo",
    since: formatSince(new Date(r.created_at)),
    lastContact: formatDate(new Date(r.created_at)),
    processes: r.process_count ?? 0,
  };
}
