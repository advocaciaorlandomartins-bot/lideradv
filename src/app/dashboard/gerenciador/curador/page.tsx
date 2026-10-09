import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { listarTeses, listarCasosAprendidos } from "@/lib/curador-db";
import TeseToggle from "@/components/dashboard/gerenciador/tese-toggle";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Curador do Cérebro — LiderAdv",
};

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const RESULTADO_LABEL: Record<string, string> = {
  deferido: "Deferido",
  indeferido: "Indeferido",
  parcialmente_deferido: "Parcialmente deferido",
};

export default async function CuradorPage() {
  const user = await getSession();
  // Mesma restrição da tela de Auditoria — o conteúdo aqui é "o que o
  // Cérebro aprendeu com casos reais", dado sensível de estratégia do
  // escritório, não é pra qualquer advogado ver/desativar.
  if (
    !user ||
    !hasPermission(user, "gerenciador", "ver") ||
    (user.categoria !== "Administrador(a)" && user.categoria !== "Sócio(a)")
  )
    notFound();

  const [teses, casos] = await Promise.all([
    listarTeses(),
    listarCasosAprendidos(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-gray-900">
          Curador do Cérebro
        </h1>
        <p className="mt-1 font-body text-sm text-gray-500">
          Revisão humana do que o Cérebro Jurídico aprendeu de casos encerrados.
          Teses <strong>ativas</strong> são injetadas de verdade em petições
          futuras do mesmo tipo de benefício — desative aqui qualquer uma que
          pareça errada ou desatualizada.
        </p>
        <p className="mt-1 font-body text-xs text-amber-700">
          ⚠️ Volume ainda baixo ({casos.length} caso
          {casos.length !== 1 ? "s" : ""} encerrado
          {casos.length !== 1 ? "s" : ""} com aprendizado registrado) — isto é
          uma tela de revisão manual, não um ranking automático confiável ainda.
          Taxa de sucesso com poucas aplicações não significa muita coisa
          estatisticamente.
        </p>
      </div>

      {/* ── Teses ── */}
      <div className="mb-8 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-slate-50 px-4 py-3">
          <h2 className="font-heading text-sm font-bold text-fg">
            Teses aprendidas ({teses.length})
          </h2>
        </div>
        {teses.length === 0 ? (
          <p className="px-4 py-6 font-body text-sm text-muted">
            Nenhuma tese registrada ainda.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {teses.map((t) => (
              <div key={t.id} className="flex items-start gap-4 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-body text-xs font-semibold text-muted">
                    {t.area}
                    {t.tipoAcao ? ` · ${t.tipoAcao}` : ""} ·{" "}
                    {fmtData(t.criadoEm)}
                  </p>
                  <p className="mt-1 font-body text-sm text-fg whitespace-pre-wrap">
                    {t.tese}
                  </p>
                  <p className="mt-2 font-body text-xs text-muted">
                    Aplicada {t.vezesAplicada}x · venceu {t.vezesVenceu}x
                    {t.taxaSucesso !== null &&
                      ` · ${t.taxaSucesso.toFixed(0)}% de sucesso`}
                  </p>
                </div>
                <TeseToggle teseId={t.id} ativaInicial={t.ativa} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Casos ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-slate-50 px-4 py-3">
          <h2 className="font-heading text-sm font-bold text-fg">
            Casos encerrados com aprendizado ({casos.length})
          </h2>
        </div>
        {casos.length === 0 ? (
          <p className="px-4 py-6 font-body text-sm text-muted">
            Nenhum caso processado ainda.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {casos.map((c) => (
              <div key={c.id} className="px-4 py-4">
                <p className="font-body text-xs font-semibold text-muted">
                  {c.tipoAcao ?? "—"} ·{" "}
                  {c.resultadoFinal
                    ? (RESULTADO_LABEL[c.resultadoFinal] ?? c.resultadoFinal)
                    : "—"}{" "}
                  · {fmtData(c.criadoEm)}
                </p>
                {c.licao && (
                  <p className="mt-1 font-body text-sm text-fg">{c.licao}</p>
                )}
                {c.argumentosVencedores.length > 0 && (
                  <p className="mt-1 font-body text-xs text-emerald-700">
                    + {c.argumentosVencedores.join(" · ")}
                  </p>
                )}
                {c.errosCometidos.length > 0 && (
                  <p className="mt-1 font-body text-xs text-red-600">
                    − {c.errosCometidos.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
