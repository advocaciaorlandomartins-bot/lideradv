import "server-only";
import sql from "./db";

export type BibliotecaCategoria = "modelo_peticao" | "precedente" | "outro";
export type BibliotecaStatus =
  | "processando"
  | "pendente_revisao"
  | "aprovado"
  | "rejeitado"
  | "erro";

export interface BibliotecaItem {
  id: string;
  nome: string;
  nomeOriginal: string;
  tipo: string;
  tamanho: number | null;
  url: string;
  categoria: BibliotecaCategoria | null;
  status: BibliotecaStatus;
  erroClassificacao: string | null;
  resumo: string | null;
  area: string | null;
  tipoPeticao: string | null;
  tribunal: string | null;
  identificacao: string | null;
  tese: string | null;
  beneficiosAplicaveis: string[];
  textoExtraido: string | null;
  enviadoPorNome: string | null;
  revisadoPorNome: string | null;
  revisadoEm: string | null;
  precedenteId: string | null;
  iaPeticaoId: string | null;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): BibliotecaItem {
  return {
    id: r.id,
    nome: r.nome,
    nomeOriginal: r.nome_original,
    tipo: r.tipo,
    tamanho: r.tamanho != null ? Number(r.tamanho) : null,
    url: r.url,
    categoria: r.categoria ?? null,
    status: r.status,
    erroClassificacao: r.erro_classificacao ?? null,
    resumo: r.resumo ?? null,
    area: r.area ?? null,
    tipoPeticao: r.tipo_peticao ?? null,
    tribunal: r.tribunal ?? null,
    identificacao: r.identificacao ?? null,
    tese: r.tese ?? null,
    beneficiosAplicaveis: Array.isArray(r.beneficios_aplicaveis)
      ? r.beneficios_aplicaveis
      : [],
    textoExtraido: r.texto_extraido ?? null,
    enviadoPorNome: r.enviado_por_nome ?? null,
    revisadoPorNome: r.revisado_por_nome ?? null,
    revisadoEm: r.revisado_em ? new Date(r.revisado_em).toISOString() : null,
    precedenteId: r.precedente_id ?? null,
    iaPeticaoId: r.ia_peticao_id ?? null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

const SELECT_BASE = `
  SELECT
    b.id::text, b.nome, b.nome_original, b.tipo, b.tamanho, b.url,
    b.categoria, b.status, b.erro_classificacao, b.resumo, b.area,
    b.tipo_peticao, b.tribunal, b.identificacao, b.tese,
    b.beneficios_aplicaveis, b.texto_extraido,
    ue.nome AS enviado_por_nome, ur.nome AS revisado_por_nome,
    b.revisado_em, b.precedente_id::text, b.ia_peticao_id::text, b.created_at
  FROM biblioteca_juridica b
  LEFT JOIN usuarios ue ON ue.id = b.enviado_por
  LEFT JOIN usuarios ur ON ur.id = b.revisado_por
`;

export async function listarBibliotecaJuridica(filtros?: {
  status?: BibliotecaStatus;
  categoria?: BibliotecaCategoria;
  busca?: string;
}): Promise<BibliotecaItem[]> {
  const status = filtros?.status ?? null;
  const categoria = filtros?.categoria ?? null;
  const busca = filtros?.busca?.trim() || null;

  const rows = await sql`
    SELECT
      b.id::text, b.nome, b.nome_original, b.tipo, b.tamanho, b.url,
      b.categoria, b.status, b.erro_classificacao, b.resumo, b.area,
      b.tipo_peticao, b.tribunal, b.identificacao, b.tese,
      b.beneficios_aplicaveis, b.texto_extraido,
      ue.nome AS enviado_por_nome, ur.nome AS revisado_por_nome,
      b.revisado_em, b.precedente_id::text, b.ia_peticao_id::text, b.created_at
    FROM biblioteca_juridica b
    LEFT JOIN usuarios ue ON ue.id = b.enviado_por
    LEFT JOIN usuarios ur ON ur.id = b.revisado_por
    WHERE (${status}::text IS NULL OR b.status = ${status})
      AND (${categoria}::text IS NULL OR b.categoria = ${categoria})
      AND (
        ${busca}::text IS NULL
        OR b.nome ILIKE ${busca ? `%${busca}%` : null}
        OR b.tese ILIKE ${busca ? `%${busca}%` : null}
        OR b.resumo ILIKE ${busca ? `%${busca}%` : null}
        OR b.identificacao ILIKE ${busca ? `%${busca}%` : null}
      )
    ORDER BY
      CASE b.status WHEN 'pendente_revisao' THEN 0 WHEN 'processando' THEN 1 WHEN 'erro' THEN 2 ELSE 3 END,
      b.created_at DESC
    LIMIT 200
  `;
  return rows.map(mapRow);
}

export async function getBibliotecaItemById(
  id: string
): Promise<BibliotecaItem | null> {
  const rows = await sql.query(`${SELECT_BASE} WHERE b.id = $1`, [id]);
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function criarItemBiblioteca(opts: {
  nomeOriginal: string;
  tipo: string;
  tamanho: number | null;
  caminho: string;
  url: string;
  enviadoPor: string;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO biblioteca_juridica
      (nome, nome_original, tipo, tamanho, caminho, url, enviado_por, status)
    VALUES (
      ${opts.nomeOriginal}, ${opts.nomeOriginal}, ${opts.tipo}, ${opts.tamanho},
      ${opts.caminho}, ${opts.url}, ${opts.enviadoPor}::uuid, 'processando'
    )
    RETURNING id::text
  `;
  return rows[0].id as string;
}

export async function salvarClassificacao(
  id: string,
  dados: {
    categoria: BibliotecaCategoria;
    nomeSugerido: string | null;
    resumo: string | null;
    area: string | null;
    tipoPeticao: string | null;
    tribunal: string | null;
    identificacao: string | null;
    tese: string | null;
    beneficiosAplicaveis: string[];
    textoExtraido: string | null;
  }
): Promise<void> {
  await sql`
    UPDATE biblioteca_juridica
    SET categoria = ${dados.categoria},
        nome = COALESCE(${dados.nomeSugerido}, nome),
        resumo = ${dados.resumo},
        area = ${dados.area},
        tipo_peticao = ${dados.tipoPeticao},
        tribunal = ${dados.tribunal},
        identificacao = ${dados.identificacao},
        tese = ${dados.tese},
        beneficios_aplicaveis = ${dados.beneficiosAplicaveis},
        texto_extraido = ${dados.textoExtraido},
        status = 'pendente_revisao'
    WHERE id = ${id}::uuid
  `;
}

export async function marcarErroClassificacao(
  id: string,
  erro: string
): Promise<void> {
  await sql`
    UPDATE biblioteca_juridica
    SET status = 'erro', erro_classificacao = ${erro}
    WHERE id = ${id}::uuid
  `;
}

/**
 * Aprova um item revisado — grava de verdade em `precedentes` (Jurisprudência
 * Viva, já consultada pelo Cérebro Jurídico e pelo Dr. Lex) ou em
 * `ia_peticoes` (banco de petições-referência), com os campos FINAIS que o
 * revisor confirmou/editou na tela (não necessariamente os que a IA sugeriu
 * — a extração da IA é só um rascunho, nunca grava direto). Qualquer
 * conflito de UNIQUE (tribunal, identificacao) em `precedentes` propaga como
 * erro em vez de duplicar silenciosamente.
 */
export async function aprovarItemBiblioteca(
  id: string,
  revisadoPor: string,
  campos:
    | {
        categoria: "precedente";
        tribunal: string;
        identificacao: string;
        tese: string;
        beneficiosAplicaveis: string[];
        observacao: string | null;
      }
    | {
        categoria: "modelo_peticao";
        area: string;
        tipoPeticao: string;
        titulo: string;
        texto: string;
        resumo: string | null;
      }
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (campos.categoria === "precedente") {
      const rows = await sql`
        INSERT INTO precedentes
          (tribunal, identificacao, tese, beneficios, status, observacao, verificado_em)
        VALUES (
          ${campos.tribunal}, ${campos.identificacao}, ${campos.tese},
          ${campos.beneficiosAplicaveis}, 'vigente', ${campos.observacao}, NOW()
        )
        RETURNING id::text
      `;
      const precedenteId = rows[0].id as string;
      await sql`
        UPDATE biblioteca_juridica
        SET status = 'aprovado', revisado_por = ${revisadoPor}::uuid,
            revisado_em = NOW(), precedente_id = ${precedenteId}::uuid
        WHERE id = ${id}::uuid
      `;
    } else {
      const rows = await sql`
        INSERT INTO ia_peticoes
          (area, tipo_peticao, titulo, texto, resumo, aprovada, created_by)
        VALUES (
          ${campos.area}, ${campos.tipoPeticao}, ${campos.titulo},
          ${campos.texto}, ${campos.resumo}, TRUE, ${revisadoPor}::uuid
        )
        RETURNING id::text
      `;
      const iaPeticaoId = rows[0].id as string;
      await sql`
        UPDATE biblioteca_juridica
        SET status = 'aprovado', revisado_por = ${revisadoPor}::uuid,
            revisado_em = NOW(), ia_peticao_id = ${iaPeticaoId}::uuid
        WHERE id = ${id}::uuid
      `;
    }
    return { ok: true };
  } catch (err) {
    console.error("[aprovarItemBiblioteca] erro:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("precedentes_tribunal_identificacao_key"))
      return {
        ok: false,
        error: `Já existe um precedente cadastrado com essa identificação (${campos.categoria === "precedente" ? `${campos.tribunal} — ${campos.identificacao}` : ""}).`,
      };
    return { ok: false, error: "Erro ao aprovar e gravar na base." };
  }
}

export async function rejeitarItemBiblioteca(
  id: string,
  revisadoPor: string
): Promise<void> {
  await sql`
    UPDATE biblioteca_juridica
    SET status = 'rejeitado', revisado_por = ${revisadoPor}::uuid, revisado_em = NOW()
    WHERE id = ${id}::uuid
  `;
}

export async function excluirItemBiblioteca(id: string): Promise<void> {
  await sql`DELETE FROM biblioteca_juridica WHERE id = ${id}::uuid`;
}
