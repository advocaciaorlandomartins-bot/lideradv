import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import AgendaWrapper from "./agenda-wrapper";

export const metadata = { title: "Agenda — AdvMartins" };
export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const session = await getSession();

  const fontes: string[] = [];
  if (session && hasPermission(session, "controles", "ver"))
    fontes.push("prazos e controles");
  if (session && hasPermission(session, "financeiro", "ver"))
    fontes.push("vencimentos financeiros");
  if (session && hasPermission(session, "clientes", "ver"))
    fontes.push("aniversários de clientes");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-fg">Agenda</h1>
        <p className="mt-1 font-body text-sm text-muted">
          {fontes.length > 0
            ? `Exibindo: ${fontes.join(" · ")}`
            : "Calendário integrado com os dados do escritório"}
        </p>
      </div>
      <AgendaWrapper />
    </div>
  );
}
