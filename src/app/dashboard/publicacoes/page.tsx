import { getAllPublicacoes, getAllOabs } from "@/lib/publicacoes-db";
import PublicacoesContent from "@/components/dashboard/publicacoes/publicacoes-content";

export const metadata = { title: "Publicações — AdvMartins" };
export const dynamic = "force-dynamic";

export default async function PublicacoesPage() {
  const [publicacoes, oabs] = await Promise.all([
    getAllPublicacoes(),
    getAllOabs(),
  ]);
  const naoLidas = publicacoes.filter((p) => p.status === "nao_lida").length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-fg">
            📬 Publicações
          </h1>
          <p className="mt-1 font-body text-sm text-muted">
            {publicacoes.length} publicações cadastradas
            {naoLidas > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-body text-xs font-semibold text-amber-700">
                {naoLidas} não lidas
              </span>
            )}
          </p>
        </div>
      </div>

      <PublicacoesContent publicacoes={publicacoes} oabs={oabs} />
    </div>
  );
}
