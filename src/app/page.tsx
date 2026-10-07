import LandingPageClient from "@/components/landing-page-client";
import { getBrandingSrcs } from "@/lib/branding";

// A logo é configurável em Configurações e precisa refletir sem redeploy —
// sem isso o Next prerenderia esta página estática, congelando a logo do
// momento do build.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { iconSrc } = await getBrandingSrcs();
  return <LandingPageClient iconSrc={iconSrc} />;
}
