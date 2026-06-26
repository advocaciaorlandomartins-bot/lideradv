import ResetSenhaForm from "@/components/reset-senha-form";

export default async function ResetSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; redefinido?: string }>;
}) {
  const params = await searchParams;
  return <ResetSenhaForm token={params.token ?? null} />;
}
