/**
 * DataJud API (CNJ) — busca publicações/intimações por OAB
 * Documentação: https://datajud-wiki.cnj.jus.br/
 * API Key gratuita: cadastre em https://www.cnj.jus.br/sistemas/datajud/acesso/
 */

import sql from "./db";

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";

const TRIBUNAIS_POR_ESTADO: Record<string, string[]> = {
  AC: ["api_publica_tjac", "api_publica_trf1"],
  AL: ["api_publica_tjal", "api_publica_trf5", "api_publica_trt19"],
  AM: ["api_publica_tjam", "api_publica_trf1"],
  AP: ["api_publica_tjap", "api_publica_trf1"],
  BA: ["api_publica_tjba", "api_publica_trf1"],
  CE: ["api_publica_tjce", "api_publica_trf5"],
  DF: ["api_publica_tjdft", "api_publica_trf1"],
  ES: ["api_publica_tjes", "api_publica_trf2"],
  GO: ["api_publica_tjgo", "api_publica_trf1"],
  MA: ["api_publica_tjma", "api_publica_trf1"],
  MG: ["api_publica_tjmg", "api_publica_trf1"],
  MS: ["api_publica_tjms", "api_publica_trf3"],
  MT: ["api_publica_tjmt", "api_publica_trf1"],
  PA: ["api_publica_tjpa", "api_publica_trf1"],
  PB: ["api_publica_tjpb", "api_publica_trf5"],
  PE: ["api_publica_tjpe", "api_publica_trf5"],
  PI: ["api_publica_tjpi", "api_publica_trf1"],
  PR: ["api_publica_tjpr", "api_publica_trf4"],
  RJ: ["api_publica_tjrj", "api_publica_trf2"],
  RN: ["api_publica_tjrn", "api_publica_trf5"],
  RO: ["api_publica_tjro", "api_publica_trf1"],
  RR: ["api_publica_tjrr", "api_publica_trf1"],
  RS: ["api_publica_tjrs", "api_publica_trf4"],
  SC: ["api_publica_tjsc", "api_publica_trf4"],
  SE: ["api_publica_tjse", "api_publica_trf5"],
  SP: ["api_publica_tjsp", "api_publica_trf3"],
  TO: ["api_publica_tjto", "api_publica_trf1"],
};

interface DatajudMovimento {
  codigo: number;
  nome: string;
  dataHora: string;
  complementos?: { descricao: string; valor: string }[];
  complementosTabelados?: { descricao: string; valor: string }[];
}

interface DatajudAdvogado {
  nome: string;
  oabNumero?: string;
  oabEstado?: string;
}

interface DatajudParte {
  nome?: string;
  tipo?: string;
  advogados?: DatajudAdvogado[];
}

interface DatajudProcesso {
  numero: string;
  tribunal?: string;
  orgaoJulgador?: { nome?: string };
  dataHoraUltimaAtualizacao?: string;
  movimentos?: DatajudMovimento[];
  partes?: DatajudParte[];
}

export interface OabInput {
  id: string;
  numero: string;
  estado: string;
  nome_advogado: string | null;
}

export async function buscarPublicacoesPorOab(
  oab: OabInput,
  apiKey: string,
  diasAtras = 3
): Promise<number> {
  const tribunais = TRIBUNAIS_POR_ESTADO[oab.estado.toUpperCase()] ?? [
    `api_publica_tj${oab.estado.toLowerCase()}`,
  ];

  const oabNumero = oab.numero.replace(/\D/g, "");
  let inseridos = 0;

  const query = {
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
                        {
                          match: {
                            "partes.advogados.oabNumero": oabNumero,
                          },
                        },
                        {
                          match: {
                            "partes.advogados.oabEstado":
                              oab.estado.toUpperCase(),
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        ],
        filter: [
          {
            range: {
              dataHoraUltimaAtualizacao: {
                gte: `now-${diasAtras}d`,
              },
            },
          },
        ],
      },
    },
    sort: [{ dataHoraUltimaAtualizacao: { order: "desc" } }],
    size: 50,
  };

  for (const tribunal of tribunais) {
    try {
      const res = await fetch(`${DATAJUD_BASE}/${tribunal}/_search`, {
        method: "POST",
        headers: {
          Authorization: `ApiKey ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.warn(
          `DataJud ${tribunal}: HTTP ${res.status} para OAB ${oab.numero}/${oab.estado}`
        );
        continue;
      }

      const data = await res.json();
      const hits: { _source: DatajudProcesso }[] = data?.hits?.hits ?? [];

      for (const hit of hits) {
        const src = hit._source;
        const processo = src.numero ?? "";
        if (!processo) continue;

        const tribunalNome =
          src.tribunal ??
          tribunal
            .replace("api_publica_", "")
            .toUpperCase()
            .replace(/^TJ/, "TJ-")
            .replace(/^TRT(\d+)$/, "TRT $1ª Região");

        const orgao = src.orgaoJulgador?.nome ?? "—";

        const advogados = (src.partes ?? [])
          .flatMap((p) => p.advogados ?? [])
          .map((a) => a.nome)
          .filter(Boolean)
          .slice(0, 5);

        // Filtra movimentos recentes
        const limite = new Date();
        limite.setDate(limite.getDate() - diasAtras);

        const movimentosRecentes = (src.movimentos ?? []).filter((m) => {
          try {
            return new Date(m.dataHora) >= limite;
          } catch {
            return false;
          }
        });

        if (movimentosRecentes.length === 0) continue;

        for (const mov of movimentosRecentes.slice(0, 5)) {
          const tipo = mov.nome || "Publicação";
          const disponibilizacao = new Date(mov.dataHora)
            .toISOString()
            .slice(0, 10);

          const partes = [
            ...(mov.complementos ?? []),
            ...(mov.complementosTabelados ?? []),
          ];
          const conteudo =
            partes.length > 0
              ? partes.map((c) => `${c.descricao}: ${c.valor}`).join("; ")
              : null;

          // Verifica se já existe
          const existe = await sql`
            SELECT 1 FROM publicacoes
            WHERE processo = ${processo}
              AND tipo = ${tipo}
              AND disponibilizacao = ${disponibilizacao}::date
            LIMIT 1
          `;

          if (existe.length > 0) continue;

          await sql`
            INSERT INTO publicacoes
              (processo, tipo, destinatario, advogados, orgao, tribunal, disponibilizacao, status, origem, conteudo)
            VALUES (
              ${processo},
              ${tipo},
              ${oab.nome_advogado ?? `OAB/${oab.estado} ${oab.numero}`},
              ${advogados},
              ${orgao},
              ${tribunalNome},
              ${disponibilizacao}::date,
              'nao_lida',
              'automatica',
              ${conteudo}
            )
          `;
          inseridos++;
        }
      }
    } catch (err) {
      console.error(`Erro DataJud ${tribunal} (OAB ${oab.numero}):`, err);
    }
  }

  // Atualiza ultima_busca
  await sql`
    UPDATE oabs_monitoradas SET ultima_busca = now() WHERE id = ${oab.id}::uuid
  `;

  return inseridos;
}
