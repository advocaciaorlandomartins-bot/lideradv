import sql from "./db";
import type { Etiqueta, EscopoEtiqueta } from "./etiquetas-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEtiqueta(r: any): Etiqueta {
  return {
    id: String(r.id),
    categoria: String(r.categoria),
    valor: String(r.valor),
    cor: String(r.cor),
    escopo: r.escopo as EscopoEtiqueta,
  };
}

/** Catálogo completo de etiquetas cadastradas (pra autocomplete/seletor). */
export async function getCatalogoEtiquetas(): Promise<Etiqueta[]> {
  const rows = await sql`
    SELECT id::text, categoria, valor, cor, escopo
    FROM etiquetas
    ORDER BY categoria ASC, valor ASC
  `;
  return rows.map(mapEtiqueta);
}

export async function getEtiquetaPorId(id: string): Promise<Etiqueta | null> {
  const rows = await sql`
    SELECT id::text, categoria, valor, cor, escopo FROM etiquetas WHERE id = ${id}::uuid
  `;
  return rows[0] ? mapEtiqueta(rows[0]) : null;
}

export async function getEtiquetaPorCategoriaValor(
  categoria: string,
  valor: string
): Promise<Etiqueta | null> {
  const rows = await sql`
    SELECT id::text, categoria, valor, cor, escopo
    FROM etiquetas
    WHERE categoria = ${categoria} AND valor = ${valor}
  `;
  return rows[0] ? mapEtiqueta(rows[0]) : null;
}

export async function getEtiquetasDeCliente(
  clienteId: string
): Promise<Etiqueta[]> {
  const rows = await sql`
    SELECT e.id::text, e.categoria, e.valor, e.cor, e.escopo
    FROM etiquetas e
    JOIN etiquetas_clientes ec ON ec.etiqueta_id = e.id
    WHERE ec.cliente_id = ${clienteId}::uuid
    ORDER BY e.categoria ASC, e.valor ASC
  `;
  return rows.map(mapEtiqueta);
}

export async function getEtiquetasDeProcesso(
  processoId: string
): Promise<Etiqueta[]> {
  const rows = await sql`
    SELECT e.id::text, e.categoria, e.valor, e.cor, e.escopo
    FROM etiquetas e
    JOIN etiquetas_processos ep ON ep.etiqueta_id = e.id
    WHERE ep.processo_id = ${processoId}::uuid
    ORDER BY e.categoria ASC, e.valor ASC
  `;
  return rows.map(mapEtiqueta);
}

/**
 * Etiquetas do cliente vinculado a este processo — "reflexo" pra visão 360°:
 * uma etiqueta aplicada no cliente aparece também ao ver qualquer processo
 * dele, sem duplicar a linha no banco.
 */
export async function getEtiquetasHerdadasDoCliente(
  processoId: string
): Promise<Etiqueta[]> {
  const rows = await sql`
    SELECT e.id::text, e.categoria, e.valor, e.cor, e.escopo
    FROM etiquetas e
    JOIN etiquetas_clientes ec ON ec.etiqueta_id = e.id
    JOIN processos p ON p.client_id = ec.cliente_id
    WHERE p.id = ${processoId}::uuid
    ORDER BY e.categoria ASC, e.valor ASC
  `;
  return rows.map(mapEtiqueta);
}

/** Bulk — todas as etiquetas de todos os clientes, pra listagem/filtro sem N+1. */
export async function getEtiquetasPorClienteBulk(): Promise<
  Map<string, Etiqueta[]>
> {
  const rows = await sql`
    SELECT ec.cliente_id::text AS cliente_id, e.id::text, e.categoria, e.valor, e.cor, e.escopo
    FROM etiquetas_clientes ec
    JOIN etiquetas e ON e.id = ec.etiqueta_id
  `;
  const map = new Map<string, Etiqueta[]>();
  for (const r of rows) {
    const clienteId = String(r.cliente_id);
    const arr = map.get(clienteId) ?? [];
    arr.push(mapEtiqueta(r));
    map.set(clienteId, arr);
  }
  return map;
}

/**
 * Bulk — etiquetas de todos os processos pra listagem/filtro, já mesclando
 * as herdadas do cliente vinculado (mesma lógica de getEtiquetasHerdadasDoCliente,
 * só que pra todo mundo de uma vez).
 */
export async function getEtiquetasPorProcessoBulk(): Promise<
  Map<string, Etiqueta[]>
> {
  const rows = await sql`
    SELECT p.id::text AS processo_id, e.id::text, e.categoria, e.valor, e.cor, e.escopo
    FROM processos p
    JOIN etiquetas_processos ep ON ep.processo_id = p.id
    JOIN etiquetas e ON e.id = ep.etiqueta_id
    UNION
    SELECT p.id::text AS processo_id, e.id::text, e.categoria, e.valor, e.cor, e.escopo
    FROM processos p
    JOIN etiquetas_clientes ec ON ec.cliente_id = p.client_id
    JOIN etiquetas e ON e.id = ec.etiqueta_id
  `;
  const map = new Map<string, Etiqueta[]>();
  for (const r of rows) {
    const processoId = String(r.processo_id);
    const arr = map.get(processoId) ?? [];
    arr.push(mapEtiqueta(r));
    map.set(processoId, arr);
  }
  return map;
}

export async function criarOuObterEtiqueta(
  categoria: string,
  valor: string,
  cor: string,
  escopo: EscopoEtiqueta
): Promise<Etiqueta> {
  const rows = await sql`
    INSERT INTO etiquetas (categoria, valor, cor, escopo)
    VALUES (${categoria}, ${valor}, ${cor}, ${escopo})
    ON CONFLICT (categoria, valor) DO UPDATE SET categoria = EXCLUDED.categoria
    RETURNING id::text, categoria, valor, cor, escopo
  `;
  return mapEtiqueta(rows[0]);
}

export async function aplicarEtiquetaCliente(
  etiquetaId: string,
  clienteId: string
): Promise<void> {
  await sql`
    INSERT INTO etiquetas_clientes (etiqueta_id, cliente_id)
    VALUES (${etiquetaId}::uuid, ${clienteId}::uuid)
    ON CONFLICT DO NOTHING
  `;
}

export async function removerEtiquetaCliente(
  etiquetaId: string,
  clienteId: string
): Promise<void> {
  await sql`
    DELETE FROM etiquetas_clientes
    WHERE etiqueta_id = ${etiquetaId}::uuid AND cliente_id = ${clienteId}::uuid
  `;
}

export async function aplicarEtiquetaProcesso(
  etiquetaId: string,
  processoId: string
): Promise<void> {
  await sql`
    INSERT INTO etiquetas_processos (etiqueta_id, processo_id)
    VALUES (${etiquetaId}::uuid, ${processoId}::uuid)
    ON CONFLICT DO NOTHING
  `;
}

export async function removerEtiquetaProcesso(
  etiquetaId: string,
  processoId: string
): Promise<void> {
  await sql`
    DELETE FROM etiquetas_processos
    WHERE etiqueta_id = ${etiquetaId}::uuid AND processo_id = ${processoId}::uuid
  `;
}
