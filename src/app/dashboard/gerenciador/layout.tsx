import GerenciadorTabs from "@/components/dashboard/gerenciador/gerenciador-tabs";

export default function GerenciadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full">
      <GerenciadorTabs />
      {children}
    </div>
  );
}
