const AVATAR_CORES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeiras = partes[0]?.[0] ?? "";
  const ultimas =
    partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primeiras + ultimas).toUpperCase();
}

function corAvatar(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + hash * 31;
  return AVATAR_CORES[Math.abs(hash) % AVATAR_CORES.length];
}

export function Avatar({
  nome,
  size = "h-8 w-8",
  className = "",
}: {
  nome: string;
  size?: string;
  className?: string;
}) {
  return (
    <span
      title={nome}
      className={`flex ${size} flex-shrink-0 items-center justify-center rounded-full font-body text-xs font-bold ${corAvatar(nome)} ${className}`}
    >
      {iniciais(nome)}
    </span>
  );
}

/** Empilha avatares com sobreposição (padrão "3 responsáveis" de kanban). */
export function AvatarStack({
  nomes,
  max = 3,
  size = "h-6 w-6",
}: {
  nomes: string[];
  max?: number;
  size?: string;
}) {
  if (nomes.length === 0) return null;
  const visiveis = nomes.slice(0, max);
  const resto = nomes.length - visiveis.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visiveis.map((n) => (
        <Avatar
          key={n}
          nome={n}
          size={size}
          className="ring-2 ring-white text-[10px]"
        />
      ))}
      {resto > 0 && (
        <span
          className={`flex ${size} flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 ring-2 ring-white`}
        >
          +{resto}
        </span>
      )}
    </div>
  );
}
