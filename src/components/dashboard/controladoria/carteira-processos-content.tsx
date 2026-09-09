import Link from "next/link";
import type {
  CarteiraResumo,
  TipoAcaoRanking,
  DesfechosAdministrativos,
} from "@/lib/controladoria-carteira-db";
import { Painel, EstadoVazio } from "./painel";
import { RankingList } from "./ranking-list";
import { FolderOpenIcon, ScalesIcon, TrophyIcon } from "@/components/icons";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CarteiraProcessosContent({
  resumo,
  rankingTipoAcao,
  desfechosAdm,
}: {
  resumo: CarteiraResumo;
  rankingTipoAcao: TipoAcaoRanking[];
  desfechosAdm: DesfechosAdministrativos;
}) {
  return (
    <div className="space-y-6">
      {/* Cards de carteira */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Total
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-fg">
            {resumo.total}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">cadastrados</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Administrativo
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-orange-600">
            {resumo.administrativoAtivos}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">ativos</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Judicial
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-purple-600">
            {resumo.judicialAtivos}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">ativos</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Arquivados
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-slate-500">
            {resumo.arquivados}
          </p>
        </div>
      </div>

      {/* 01 — Composição da carteira */}
      <div>
        <h2 className="font-heading text-base font-bold text-fg">
          01 · Composição da carteira
        </h2>
        <p className="font-body text-xs italic text-muted">
          Onde estão os {resumo.total} processos cadastrados, por tipo de ação.
        </p>
      </div>
      <Painel
        titulo="Tipos de ação"
        icon={<FolderOpenIcon className="h-4.5 w-4.5 text-primary" />}
        baseDeCalculo={`Base: ${rankingTipoAcao.reduce((s, r) => s + r.total, 0)} processos com tipo de ação preenchido (exclui cadastros incompletos).`}
      >
        {rankingTipoAcao.length === 0 ? (
          <EstadoVazio texto="Nenhum processo com tipo de ação preenchido ainda." />
        ) : (
          <RankingList
            itens={rankingTipoAcao.map((r) => ({
              key: r.tipoAcao,
              label: r.tipoAcao,
              total: r.total,
              pct: r.pct,
              extra:
                r.valorCausaMediana != null
                  ? `mediana ${fmtBRL(r.valorCausaMediana)}`
                  : undefined,
            }))}
          />
        )}
      </Painel>

      {/* 02 — Resultados */}
      <div>
        <h2 className="font-heading text-base font-bold text-fg">
          02 · Resultados administrativos
        </h2>
        <p className="font-body text-xs italic text-muted">
          Só entram processos com resultado do INSS já registrado.
        </p>
      </div>
      <Painel
        titulo="Desfechos"
        icon={<ScalesIcon className="h-4.5 w-4.5 text-primary" />}
        baseDeCalculo={`Base: ${desfechosAdm.decididos} processo(s) com resultado administrativo registrado.`}
      >
        {desfechosAdm.decididos === 0 ? (
          <EstadoVazio texto="Nenhum processo com resultado administrativo registrado ainda — este painel aparece assim que o primeiro 'Registrar Resultado' acontecer na Produção." />
        ) : (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <TrophyIcon className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-heading text-2xl font-bold text-fg">
                  {desfechosAdm.pctExito}%
                </p>
                <p className="font-body text-xs text-muted">
                  êxito em {desfechosAdm.decididos} decidido
                  {desfechosAdm.decididos !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-4 border-l border-border pl-6">
              <div>
                <p className="font-heading text-lg font-bold text-emerald-600">
                  {desfechosAdm.concedidos}
                </p>
                <p className="font-body text-xs text-muted">Concedido</p>
              </div>
              <div>
                <p className="font-heading text-lg font-bold text-red-600">
                  {desfechosAdm.negados}
                </p>
                <p className="font-body text-xs text-muted">Negado</p>
              </div>
            </div>
          </div>
        )}
      </Painel>

      {/* Valor da causa — honesto: campo existe mas está zerado hoje */}
      {resumo.valorCausaAmostra === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 p-5">
          <p className="font-body text-sm font-semibold text-amber-800">
            Valor da causa ainda não é usado
          </p>
          <p className="mt-1 font-body text-xs text-muted">
            Nenhum dos {resumo.total} processos tem o campo &quot;Valor da
            causa&quot; preenchido — por isso não dá pra mostrar soma/mediana da
            carteira ainda. Preencha esse campo ao cadastrar ou editar um
            processo e este painel passa a funcionar sozinho.{" "}
            <Link
              href="/dashboard/processos"
              className="font-semibold text-primary hover:underline"
            >
              Ver processos →
            </Link>
          </p>
        </div>
      ) : (
        <Painel titulo="Valor da carteira">
          <div className="flex gap-6">
            <div>
              <p className="font-heading text-xl font-bold text-fg">
                {fmtBRL(resumo.valorCausaSoma)}
              </p>
              <p className="font-body text-xs text-muted">soma</p>
            </div>
            <div>
              <p className="font-heading text-xl font-bold text-fg">
                {resumo.valorCausaMediana != null
                  ? fmtBRL(resumo.valorCausaMediana)
                  : "—"}
              </p>
              <p className="font-body text-xs text-muted">mediana</p>
            </div>
          </div>
        </Painel>
      )}
    </div>
  );
}
