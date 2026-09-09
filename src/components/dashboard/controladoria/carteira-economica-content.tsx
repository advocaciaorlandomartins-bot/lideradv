import Link from "next/link";
import type { CarteiraResumo } from "@/lib/controladoria-carteira-db";
import { BanknotesIcon, ArrowRightIcon } from "@/components/icons";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CarteiraEconomicaContent({
  resumo,
}: {
  resumo: CarteiraResumo;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-base font-bold text-fg">
          01 · O valor da carteira
        </h2>
        <p className="font-body text-xs italic text-muted">
          Valor da causa dos processos — respeita seu acesso (só sua carteira,
          se você não vir todos os processos).
        </p>
      </div>

      {resumo.valorCausaAmostra === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 p-5">
          <p className="font-body text-sm font-semibold text-amber-800">
            Valor da causa ainda não é usado
          </p>
          <p className="mt-1 font-body text-xs text-muted">
            Nenhum dos {resumo.total} processos tem &quot;Valor da causa&quot;
            preenchido — soma, mediana e a divisão por área ficam disponíveis
            assim que esse campo começar a ser preenchido no cadastro/edição de
            processo.{" "}
            <Link
              href="/dashboard/processos"
              className="font-semibold text-primary hover:underline"
            >
              Ver processos →
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
              Valor da causa (soma)
            </p>
            <p className="mt-1 font-heading text-xl font-semibold text-fg">
              {fmtBRL(resumo.valorCausaSoma)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
              Mediana
            </p>
            <p className="mt-1 font-heading text-xl font-semibold text-fg">
              {resumo.valorCausaMediana != null
                ? fmtBRL(resumo.valorCausaMediana)
                : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
              Amostra
            </p>
            <p className="mt-1 font-heading text-xl font-semibold text-fg">
              {resumo.valorCausaAmostra} de {resumo.total}
            </p>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-heading text-base font-bold text-fg">
          02 · O caixa do escritório
        </h2>
        <p className="font-body text-xs italic text-muted">
          Sem relação com o recorte acima — todos os lançamentos do financeiro,
          sem filtro de processo/responsável.
        </p>
      </div>
      <Link
        href="/dashboard/financeiro"
        className="flex items-center justify-between rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <BanknotesIcon className="h-4.5 w-4.5 text-emerald-600" />
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-fg">
              A receber, recebido, vencidas e fluxo de caixa
            </p>
            <p className="font-body text-xs text-muted">
              Já existe no módulo Financeiro — sem duplicar aqui, pra nunca
              divergir de um lugar pro outro.
            </p>
          </div>
        </div>
        <ArrowRightIcon className="h-4 w-4 flex-shrink-0 text-muted" />
      </Link>
    </div>
  );
}
