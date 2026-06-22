import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Endpoint temporário de diagnóstico DataJud — remove após usar
export async function GET(request: Request) {
  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "DATAJUD_API_KEY não configurada" },
      { status: 503 }
    );

  const base = "https://api-publica.datajud.cnj.jus.br";
  const headers = {
    Authorization: `ApiKey ${apiKey}`,
    "Content-Type": "application/json",
  };

  const url = new URL(request.url);
  const tribunal = url.searchParams.get("tribunal") ?? "api_publica_trf5";
  const oab = url.searchParams.get("oab") ?? "14381";
  const estado = url.searchParams.get("estado") ?? "AL";
  const dias = parseInt(url.searchParams.get("dias") ?? "30");

  // Query 1: busca por OABNumero sem ponto (jeito atual)
  const q1 = {
    query: {
      bool: {
        must: [
          {
            nested: {
              path: "partes",
              query: {
                nested: {
                  path: "partes.advogados",
                  query: {
                    bool: {
                      must: [
                        { match: { "partes.advogados.OABNumero": oab } },
                        { match: { "partes.advogados.OABEstado": estado } },
                      ],
                    },
                  },
                },
              },
            },
          },
        ],
        filter: [
          { range: { dataHoraUltimaAtualizacao: { gte: `now-${dias}d` } } },
        ],
      },
    },
    sort: [{ dataHoraUltimaAtualizacao: { order: "desc" } }],
    size: 3,
  };

  // Query 2: busca por OABNumero com letra minúscula (jeito atual do código)
  const q2 = {
    query: {
      bool: {
        must: [
          {
            nested: {
              path: "partes",
              query: {
                nested: {
                  path: "partes.advogados",
                  query: {
                    bool: {
                      must: [
                        { match: { "partes.advogados.oabNumero": oab } },
                        { match: { "partes.advogados.oabEstado": estado } },
                      ],
                    },
                  },
                },
              },
            },
          },
        ],
        filter: [
          { range: { dataHoraUltimaAtualizacao: { gte: `now-${dias}d` } } },
        ],
      },
    },
    sort: [{ dataHoraUltimaAtualizacao: { order: "desc" } }],
    size: 3,
  };

  // Query 3: match_all — ver quantos docs existem no índice e estrutura real
  const q3 = {
    query: { match_all: {} },
    sort: [{ dataHoraUltimaAtualizacao: { order: "desc" } }],
    size: 1,
    _source: ["numero", "tribunal", "partes", "dataHoraUltimaAtualizacao"],
  };

  // Query 4: busca processo que tenha partes com advogados para ver estrutura
  const q4 = {
    query: { exists: { field: "partes.advogados" } },
    size: 1,
    _source: true,
  };

  // Query 5: full-text multi_match sem nested para encontrar qualquer campo com ORLANDO
  const q5 = {
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query: "JOSE ORLANDO",
              type: "best_fields",
              lenient: true,
            },
          },
        ],
        filter: [
          { range: { dataHoraUltimaAtualizacao: { gte: `now-${dias}d` } } },
        ],
      },
    },
    size: 2,
    _source: true,
  };

  // Query 6: busca processo específico do TRF5 sem filtro de advogado — ver estrutura de partes
  const q6 = {
    query: {
      bool: {
        filter: [
          { range: { dataHoraUltimaAtualizacao: { gte: `now-${dias}d` } } },
          { exists: { field: "partes" } },
        ],
      },
    },
    size: 1,
    _source: true,
  };

  // Mapping do índice — mostra todos os campos disponíveis
  const mapping = await fetch(`${base}/${tribunal}/_mapping`, {
    headers,
    signal: AbortSignal.timeout(10000),
  })
    .then((r) => r.json())
    .catch((e) => ({ error: e.message }));
  const camposDisponiveis = Object.keys(
    mapping?.[tribunal]?.mappings?.properties ??
      mapping?.mappings?.properties ??
      {}
  );

  const [r1, r2, r3, r4, r5, r6] = await Promise.all([
    fetch(`${base}/${tribunal}/_search`, {
      method: "POST",
      headers,
      body: JSON.stringify(q1),
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: e.message })),
    fetch(`${base}/${tribunal}/_search`, {
      method: "POST",
      headers,
      body: JSON.stringify(q2),
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: e.message })),
    fetch(`${base}/${tribunal}/_search`, {
      method: "POST",
      headers,
      body: JSON.stringify(q3),
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: e.message })),
    fetch(`${base}/${tribunal}/_search`, {
      method: "POST",
      headers,
      body: JSON.stringify(q4),
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: e.message })),
    fetch(`${base}/${tribunal}/_search`, {
      method: "POST",
      headers,
      body: JSON.stringify(q5),
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: e.message })),
    fetch(`${base}/${tribunal}/_search`, {
      method: "POST",
      headers,
      body: JSON.stringify(q6),
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => r.json())
      .catch((e) => ({ error: e.message })),
  ]);

  const docComPartes = r6?.hits?.hits?.[0]?._source ?? null;
  const advSample = docComPartes?.partes?.[0]?.advogados?.[0] ?? null;

  return NextResponse.json({
    tribunal,
    oab_buscado: oab,
    estado_buscado: estado,
    dias,
    campos_do_indice: camposDisponiveis,
    q1_OABNumero_maiusculo: { total: r1?.hits?.total?.value ?? 0 },
    q2_oabNumero_minusculo: { total: r2?.hits?.total?.value ?? 0 },
    multi_match_jose_orlando: {
      total: r5?.hits?.total?.value ?? 0,
      primeiro: r5?.hits?.hits?.[0]?._source ?? null,
    },
    partes_exists_query: { total: r6?.hits?.total?.value ?? 0 },
    campo_real_advogado: advSample,
    doc_com_partes: docComPartes
      ? {
          numeroProcesso: docComPartes.numeroProcesso,
          partes: docComPartes.partes,
        }
      : null,
    conexao: r3?.hits ? "ok" : "erro",
  });
}
