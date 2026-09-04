export type EscopoEtiqueta = "cliente" | "processo" | "ambos";

export interface Etiqueta {
  id: string;
  categoria: string;
  valor: string;
  cor: string;
  escopo: EscopoEtiqueta;
}

/** categoria:valor formatado, o jeito que aparece em toda a UI e nas respostas da Íris. */
export function formatarEtiqueta(
  e: Pick<Etiqueta, "categoria" | "valor">
): string {
  return `${e.categoria}:${e.valor}`;
}

export const CORES_ETIQUETA = [
  "slate",
  "red",
  "orange",
  "amber",
  "emerald",
  "cyan",
  "blue",
  "violet",
  "pink",
] as const;

export type CorEtiqueta = (typeof CORES_ETIQUETA)[number];

/** Classes Tailwind fixas por cor — nunca montar a classe por interpolação de string (o purge do Tailwind não pega classe dinâmica). */
export const COR_CLASSES: Record<
  string,
  { bg: string; text: string; dot: string; ring: string }
> = {
  slate: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-500",
    ring: "ring-slate-200",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
    ring: "ring-red-200",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-500",
    ring: "ring-orange-200",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    ring: "ring-amber-200",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200",
  },
  cyan: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
    ring: "ring-cyan-200",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    ring: "ring-blue-200",
  },
  violet: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-500",
    ring: "ring-violet-200",
  },
  pink: {
    bg: "bg-pink-50",
    text: "text-pink-700",
    dot: "bg-pink-500",
    ring: "ring-pink-200",
  },
};

export function corClasses(cor: string) {
  return COR_CLASSES[cor] ?? COR_CLASSES.slate;
}
