import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import LembretesClient from "./lembretes-client";

export default async function LembretesPage() {
  const session = await getSession();
  if (!session || session.categoria !== "Administrador(a)") notFound();

  return <LembretesClient />;
}
