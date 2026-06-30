import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";
import Link from "next/link";

export const metadata = {
  title: "Atualizações Legais — LiderAdv",
};
export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  instrucao_normativa: "Instrução Normativa",
  portaria: "Portaria",
  resolucao: "Resolução",
  decreto: "Decreto",
  circular: "Circular",
  nota_tecnica: "Nota Técnica",
  aviso: "Aviso",
  diario_oficial: "Diário Oficial",
};

const TIPO_AFETADO_LABEL: Record<string, string> = {
  aposentadoria_invalidez: "Aposentadoria por Invalidez",
  auxilio_doenca: "Auxílio-Doença",
  bpc_loas: "BPC/LOAS",
  rural: "Trabalhador Rural",
  revisao_beneficio: "Revisão de Benefício",
  salario_minimo: "Salário Mínimo",
  pensao_morte: "Pensão por Morte",
  acidente_trabalho: "Acidente de Trabalho",
  aposentadoria_tempo: "Aposentadoria por Tempo",
  aposentadoria_especial: "Aposentadoria Especial",
  calculo_beneficio: "Cálculo de Benefício",
  prazo_processo: "Prazo Processual",
  outros: "Outros",
};

function ImpactoBadge({ nivel }: { nivel: string }) {
  if (nivel === "alto")
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800">
        ● Alto Impacto
      </span>
    );
  if (nivel === "medio")
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800">
        ● Médio Impacto
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
      ● Baixo Impacto
    </span>
  );
}

export default async function AtualizacoesLegaisPage() {
  const session = await getSession();
  if (!session) notFound();

  const atualizacoes = await sql`
    SELECT id, titulo, resumo, url, data_publicacao, orgao, tipo,
           impacto, analise_ia, o_que_muda, acao_recomendada,
           tipos_afetados, lida, created_at
    FROM atualizacoes_legais
    ORDER BY
      CASE impacto WHEN 'alto' THEN 1 WHEN 'medio' THEN 2 ELSE 3 END,
      data_publicacao DESC
    LIMIT 100
  `;

  const naoLidas = atualizacoes.filter((a) => !a.lida).length;
  const altoImpacto = atualizacoes.filter((a) => a.impacto === "alto").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-fg">
            Atualizações Legais
          </h1>
          <p className="mt-1 font-body text-sm text-muted">
            Monitoramento automático do DOU — INSS, Previdência Social e
            legislação previdenciária.
            {naoLidas > 0 && (
              <span className="ml-2 font-semibold text-primary">
                {naoLidas} nova{naoLidas > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {altoImpacto > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800">
              ⚠ {altoImpacto} de alto impacto
            </span>
          )}
          <Link
            href="/api/cron/atualizacoes-legais"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted hover:bg-slate-50 transition-colors"
          >
            ↻ Buscar agora
          </Link>
        </div>
      </div>

      {/* Aviso de configuração se não tiver atualizações */}
      {atualizacoes.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold text-amber-800 mb-2">
            ⚙ Configuração necessária
          </h2>
          <p className="text-sm text-amber-700 mb-3">
            Para ativar o monitoramento automático do Diário Oficial, cadastre
            uma chave de API gratuita no InLabs (Imprensa Nacional) e configure
            no Vercel.
          </p>
          <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
            <li>
              Acesse <strong>inlabs.in.gov.br</strong> e crie uma conta gratuita
            </li>
            <li>Copie sua chave de API no painel InLabs</li>
            <li>
              No Vercel, adicione a variável:{" "}
              <code className="bg-amber-100 px-1 rounded">
                DOU_INLABS_KEY=sua_chave
              </code>
            </li>
            <li>
              Faça um novo deploy — o sistema buscará automaticamente às 08:30
            </li>
          </ol>
          <p className="mt-3 text-xs text-amber-600">
            Você também pode cadastrar atualizações manualmente usando o botão
            abaixo.
          </p>
        </div>
      )}

      {/* Lista de atualizações */}
      <div className="space-y-4">
        {(atualizacoes as Atualizacao[]).map((a) => (
          <AtualizacaoCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}

interface Atualizacao {
  id: string;
  titulo: string;
  resumo: string | null;
  url: string | null;
  data_publicacao: string;
  orgao: string | null;
  tipo: string;
  impacto: string;
  analise_ia: string | null;
  o_que_muda: string | null;
  acao_recomendada: string | null;
  tipos_afetados: string[];
  lida: boolean;
}

function AtualizacaoCard({ a }: { a: Atualizacao }) {
  const tiposAfetados = Array.isArray(a.tipos_afetados) ? a.tipos_afetados : [];

  return (
    <div
      className={`rounded-xl border bg-surface p-5 transition-colors ${
        !a.lida ? "border-primary/30 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <ImpactoBadge nivel={a.impacto} />
            <span className="text-xs text-muted bg-slate-100 rounded-full px-2 py-0.5">
              {TIPO_LABEL[a.tipo] ?? "DOU"}
            </span>
            {!a.lida && (
              <span className="text-xs font-semibold text-primary">NOVA</span>
            )}
          </div>
          <h3 className="font-semibold text-fg text-sm leading-snug">
            {a.titulo}
          </h3>
          {a.orgao && <p className="text-xs text-muted mt-0.5">{a.orgao}</p>}
        </div>
        <div className="text-right text-xs text-muted shrink-0">
          <p>{new Date(a.data_publicacao).toLocaleDateString("pt-BR")}</p>
          {a.url && (
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline mt-0.5 block"
            >
              Ver no DOU ↗
            </a>
          )}
        </div>
      </div>

      {/* Análise IA */}
      {a.analise_ia && (
        <div className="space-y-3 mt-3 pt-3 border-t border-border">
          <p className="text-sm text-fg">{a.analise_ia}</p>

          {a.o_que_muda && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
              <p className="text-xs font-semibold text-blue-700 mb-0.5">
                O que muda na prática
              </p>
              <p className="text-sm text-blue-800">{a.o_que_muda}</p>
            </div>
          )}

          {a.acao_recomendada && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-700 mb-0.5">
                Ação recomendada
              </p>
              <p className="text-sm text-emerald-800">{a.acao_recomendada}</p>
            </div>
          )}

          {tiposAfetados.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tiposAfetados.map((t) => (
                <span
                  key={t}
                  className="text-xs rounded-full bg-slate-100 text-slate-600 px-2 py-0.5"
                >
                  {TIPO_AFETADO_LABEL[t] ?? t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!a.lida && <MarcarLidaButton id={a.id} />}
    </div>
  );
}

function MarcarLidaButton({ id }: { id: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const { default: sqlServer } = await import("@/lib/db");
        await sqlServer`UPDATE atualizacoes_legais SET lida = TRUE WHERE id = ${id}`;
      }}
      className="mt-3 pt-3 border-t border-border"
    >
      <button
        type="submit"
        className="text-xs text-muted hover:text-fg transition-colors"
      >
        ✓ Marcar como lida
      </button>
    </form>
  );
}
