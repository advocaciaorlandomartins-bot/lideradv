import ResetSenhaForm from "@/components/reset-senha-form";
import { getBrandingSrcs } from "@/lib/branding";

export default async function ResetSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; redefinido?: string }>;
}) {
  const params = await searchParams;
  const { logoSrc } = await getBrandingSrcs();
  return <ResetSenhaForm token={params.token ?? null} logoSrc={logoSrc} />;
}
