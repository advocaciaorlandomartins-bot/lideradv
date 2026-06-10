import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session, "gerenciador", "ver")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const domain = process.env.INBOUND_EMAIL_DOMAIN ?? "timails.org";
  const configured = domain !== "timails.org";

  return NextResponse.json({
    domain,
    configured,
    webhookUrl: "https://lideradv.vercel.app/api/webhooks/inbound-email",
  });
}
