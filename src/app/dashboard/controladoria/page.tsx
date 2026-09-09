import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import {
  getRankingDetalhado,
  filtrarHistoricoPorPermissao,
} from "@/lib/pontuacao";
import {
  getCargaColaboradores,
  getCapacidadeResumo,
  filtrarCargaPorPermissao,
} from "@/lib/controladoria-db";
import {
  getCarteiraResumo,
  getRankingTipoAcao,
  getDesfechosAdministrativos,
  getClientesResumo,
  getClientesPorMes,
  getClientesPorUF,
  getClientesPorOrigem,
} from "@/lib/controladoria-carteira-db";
import { getColaboradorIdForUser } from "@/lib/usuarios-db";
import ControladoriaContent from "@/components/dashboard/controladoria/controladoria-content";
import CarteiraProcessosContent from "@/components/dashboard/controladoria/carteira-processos-content";
import CarteiraEconomicaContent from "@/components/dashboard/controladoria/carteira-economica-content";
import CarteiraClientesContent from "@/components/dashboard/controladoria/carteira-clientes-content";
import {
  UsersIcon,
  FolderOpenIcon,
  BanknotesIcon,
  TrophyIcon,
} from "@/components/icons";

export const metadata = {
  title: "Controladoria — LiderAdv",
};

export const dynamic = "force-dynamic";

type Tab = "equipe" | "processos" | "economica" | "clientes";

function resolveTab(raw: string | undefined): Tab {
  if (raw === "processos" || raw === "economica" || raw === "clientes")
    return raw;
  return "equipe";
}

export default async function ControladoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "controladoria", "ver")) notFound();

  const { tab: rawTab } = await searchParams;
  const tab = resolveTab(rawTab);

  // "Carga da equipe"/Ranking (aba Equipe) e a carteira de processos/clientes
  // (abas novas) mostram nome, cargo e agregados de todo o escritório — quem
  // não tem processos_ver_todos só deve ver o próprio recorte, mesma regra
  // já usada em toda a Controladoria/Produção/CRM.
  const podeVerDetalhesDeTodos = hasPermission(
    session,
    "processos_ver_todos",
    "ver"
  );
  const meuColaboradorId = await getColaboradorIdForUser(session.id);
  const colaboradorIdParaFiltro = podeVerDetalhesDeTodos
    ? null
    : meuColaboradorId;

  const [ranking, carga, capacidade] =
    tab === "equipe"
      ? await Promise.all([
          getRankingDetalhado(30, colaboradorIdParaFiltro),
          getCargaColaboradores(colaboradorIdParaFiltro),
          getCapacidadeResumo(8),
        ])
      : [[], [], null];

  const [carteiraResumo, rankingTipoAcao, desfechosAdm] =
    tab === "processos"
      ? await Promise.all([
          getCarteiraResumo(colaboradorIdParaFiltro),
          getRankingTipoAcao(colaboradorIdParaFiltro),
          getDesfechosAdministrativos(colaboradorIdParaFiltro),
        ])
      : [null, [], null];

  const carteiraResumoEconomica =
    tab === "economica"
      ? await getCarteiraResumo(colaboradorIdParaFiltro)
      : null;

  const [clientesResumo, clientesPorMes, clientesPorUF, clientesPorOrigem] =
    tab === "clientes"
      ? await Promise.all([
          getClientesResumo(colaboradorIdParaFiltro),
          getClientesPorMes(24),
          getClientesPorUF(),
          getClientesPorOrigem(),
        ])
      : [null, [], null, null];

  const cargaFiltrada = filtrarCargaPorPermissao(
    carga,
    podeVerDetalhesDeTodos,
    meuColaboradorId
  );
  const rankingFiltrado = filtrarHistoricoPorPermissao(
    ranking,
    podeVerDetalhesDeTodos,
    meuColaboradorId
  );

  const tabDef: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "equipe",
      label: "Equipe",
      icon: <TrophyIcon className="h-4 w-4 flex-shrink-0" />,
    },
    {
      key: "processos",
      label: "Processos",
      icon: <FolderOpenIcon className="h-4 w-4 flex-shrink-0" />,
    },
    {
      key: "economica",
      label: "Econômica",
      icon: <BanknotesIcon className="h-4 w-4 flex-shrink-0" />,
    },
    {
      key: "clientes",
      label: "Clientes",
      icon: <UsersIcon className="h-4 w-4 flex-shrink-0" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-fg">
          Controladoria
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Ranking de produtividade, carga da equipe, carteira de processos e
          clientes — a visão que atravessa todas as outras.
        </p>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <div className="flex gap-1 rounded-xl border border-border bg-white p-1 w-fit shadow-sm">
          {tabDef.map(({ key, label, icon }) => (
            <Link
              key={key}
              href={
                key === "equipe"
                  ? "/dashboard/controladoria"
                  : `/dashboard/controladoria?tab=${key}`
              }
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-sm font-semibold transition-colors duration-150 sm:gap-2 sm:px-4 sm:py-2 whitespace-nowrap ${
                tab === key
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-fg"
              }`}
            >
              {icon}
              {label}
            </Link>
          ))}
        </div>
      </div>

      {tab === "equipe" && (
        <ControladoriaContent
          ranking={rankingFiltrado}
          carga={cargaFiltrada}
          capacidade={capacidade!}
          podeVerDetalhesDeTodos={podeVerDetalhesDeTodos}
          meuColaboradorId={meuColaboradorId}
        />
      )}
      {tab === "processos" && (
        <CarteiraProcessosContent
          resumo={carteiraResumo!}
          rankingTipoAcao={rankingTipoAcao}
          desfechosAdm={desfechosAdm!}
        />
      )}
      {tab === "economica" && (
        <CarteiraEconomicaContent resumo={carteiraResumoEconomica!} />
      )}
      {tab === "clientes" && (
        <CarteiraClientesContent
          resumo={clientesResumo!}
          porMes={clientesPorMes}
          porUF={clientesPorUF!}
          porOrigem={clientesPorOrigem!}
        />
      )}
    </div>
  );
}
