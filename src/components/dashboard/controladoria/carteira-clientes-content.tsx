import type {
  ClientesResumo,
  ClientesPorMes,
  UFRanking,
  CidadeRanking,
  OrigemRanking,
} from "@/lib/controladoria-carteira-db";
import { Painel, EstadoVazio } from "./painel";
import { RankingList } from "./ranking-list";
import { MapPinIcon, TagIcon } from "@/components/icons";

function fmtMes(mesKey: string): string {
  const [ano, mes] = mesKey.split("-");
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

export default function CarteiraClientesContent({
  resumo,
  porMes,
  porUF,
  porOrigem,
}: {
  resumo: ClientesResumo;
  porMes: ClientesPorMes[];
  porUF: { porUF: UFRanking[]; cidades: CidadeRanking[]; semUF: number };
  porOrigem: { ranking: OrigemRanking[]; semOrigem: number };
}) {
  const maxMes = Math.max(1, ...porMes.map((m) => m.novos));

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Clientes
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-fg">
            {resumo.total}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">cadastrados</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Com processo ativo
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-emerald-600">
            {resumo.comProcessoAtivo}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Novos (30 dias)
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-primary">
            {resumo.novosUltimos30d}
          </p>
        </div>
      </div>

      {/* 01 — Como a base cresce */}
      <div>
        <h2 className="font-heading text-base font-bold text-fg">
          01 · Como a base cresce
        </h2>
        <p className="font-body text-xs italic text-muted">
          Clientes novos por mês, últimos 24 meses — sempre fixo, não muda com
          nenhum filtro.
        </p>
      </div>
      <Painel titulo="Novos clientes por mês">
        {porMes.every((m) => m.novos === 0) ? (
          <EstadoVazio texto="Nenhum cliente novo nos últimos 24 meses." />
        ) : (
          <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
            {porMes.map((m) => (
              <div
                key={m.mes}
                className="flex flex-shrink-0 flex-col items-center gap-1"
                title={`${m.novos} em ${fmtMes(m.mes)}`}
              >
                <div className="flex h-24 items-end">
                  <div
                    className="w-3.5 rounded-t bg-primary/70"
                    style={{
                      height: `${Math.max(2, (m.novos / maxMes) * 100)}%`,
                    }}
                  />
                </div>
                <span className="font-body text-[9px] text-muted">
                  {fmtMes(m.mes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Painel>

      {/* 02 — Quem são e de onde vêm */}
      <div>
        <h2 className="font-heading text-base font-bold text-fg">
          02 · Quem são e de onde vêm
        </h2>
        <p className="font-body text-xs italic text-muted">
          Localização e origem dos clientes cadastrados.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel
          titulo="Onde estão"
          icon={<MapPinIcon className="h-4.5 w-4.5 text-primary" />}
          baseDeCalculo={
            porUF.semUF > 0
              ? `${porUF.semUF} cliente(s) sem UF preenchida ficam fora deste ranking (mas contam no total geral).`
              : undefined
          }
        >
          {porUF.porUF.length === 0 ? (
            <EstadoVazio texto="Nenhum cliente com UF preenchida ainda." />
          ) : (
            <div className="space-y-4">
              <RankingList
                itens={porUF.porUF.map((r) => ({
                  key: r.uf,
                  label: r.uf,
                  total: r.total,
                  pct: r.pct,
                }))}
              />
              {porUF.cidades.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Cidades mais frequentes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {porUF.cidades.map((c) => (
                      <span
                        key={`${c.cidade}-${c.uf}`}
                        className="rounded-full bg-slate-100 px-2.5 py-1 font-body text-xs text-muted"
                      >
                        {c.cidade}
                        {c.uf ? `/${c.uf}` : ""}: {c.total}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Painel>

        <Painel
          titulo="Origem"
          icon={<TagIcon className="h-4.5 w-4.5 text-primary" />}
          baseDeCalculo={
            porOrigem.semOrigem > 0
              ? `${porOrigem.semOrigem} cliente(s) sem origem informada no cadastro.`
              : undefined
          }
        >
          {porOrigem.ranking.length === 0 ? (
            <EstadoVazio texto="Nenhum cliente com origem preenchida ainda — preencha o campo 'Origem' ao cadastrar um cliente." />
          ) : (
            <RankingList
              itens={porOrigem.ranking.map((r) => ({
                key: r.origem,
                label: r.origem,
                total: r.total,
                pct: r.pct,
              }))}
            />
          )}
        </Painel>
      </div>
    </div>
  );
}
