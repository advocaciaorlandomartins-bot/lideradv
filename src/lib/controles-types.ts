export const TIPOS_CONTROLE = [
  {
    key: "audiencias",
    label: "Audiências",
    col_data: "Data",
    col_evento: "Audiência",
    label_novo: "Nova audiência",
  },
  {
    key: "prazos",
    label: "Prazos Processuais",
    col_data: "Data",
    col_evento: "Prazo",
    label_novo: "Novo prazo",
  },
  {
    key: "pericias",
    label: "Perícias e Av. Sociais",
    col_data: "Data",
    col_evento: "Perícia/Avaliação",
    label_novo: "Nova perícia",
  },
  {
    key: "dcb",
    label: "Prorrogação (DCB)",
    col_data: "Prazo para PP",
    col_evento: "Informações",
    label_novo: "Novo DCB",
  },
  {
    key: "beneficios",
    label: "Benefícios — Ag. Implantação",
    col_data: "Data",
    col_evento: "Benefício",
    label_novo: "Novo benefício",
  },
  {
    key: "implantados",
    label: "Benefícios Implantados (1° Pag.)",
    col_data: "Data",
    col_evento: "Evento",
    label_novo: "Novo benefício",
  },
  {
    key: "implantados-data",
    label: "Benefícios Implantados",
    col_data: "Data de Implantação",
    col_evento: "Evento",
    label_novo: "Novo benefício",
  },
  {
    key: "alvaras",
    label: "Alvarás / RPVs",
    col_data: "Data",
    col_evento: "Alvará / RPV",
    label_novo: "Novo alvará",
  },
] as const;

export type TipoControle = (typeof TIPOS_CONTROLE)[number]["key"];

export const TIPOS_DEMANDA = [
  "Judicial",
  "Extrajudicial",
  "Consultiva",
] as const;

export const STATUS_CONTROLE = {
  pendente: {
    label: "Aguardando",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  concluido: {
    label: "Concluído",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  cancelado: {
    label: "Cancelado",
    color: "bg-slate-100 text-slate-500 border-slate-200",
  },
} as const;

export type StatusControle = keyof typeof STATUS_CONTROLE;

export interface Controle {
  id: string;
  tipo: TipoControle;
  data_evento: string | null;
  descricao: string;
  status: StatusControle;
  cliente_id: string | null;
  cliente_nome: string | null;
  processo_id: string | null;
  processo_numero: string | null;
  responsavel_id: string | null;
  responsavel_login: string | null;
  tipo_demanda: string | null;
  observacoes: string | null;
  prazo_interno: string | null;
  dados: Record<string, string | null> | null;
  created_at: string;
}

export interface LocalAudiencia {
  id: string;
  titulo: string;
  endereco: string | null;
  mapa_url: string | null;
}

export interface ClienteOption {
  id: string;
  nome: string;
  doc: string;
}
export interface ProcessoOption {
  id: string;
  numero: string;
  cliente_id: string;
}
export interface UsuarioOption {
  id: string;
  login: string;
  nome: string;
}

export function getTipoConfig(tipo: string) {
  return TIPOS_CONTROLE.find((t) => t.key === tipo) ?? TIPOS_CONTROLE[0];
}

export function dbStatusToKey(s: string | null): StatusControle {
  if (s === "concluido") return "concluido";
  if (s === "cancelado") return "cancelado";
  return "pendente";
}

export function urgencyClass(dataEvento: string | null): string {
  if (!dataEvento) return "bg-slate-300";
  const diff = new Date(dataEvento).getTime() - Date.now();
  const days = diff / 86400000;
  if (days < 0) return "bg-red-500";
  if (days < 7) return "bg-amber-500";
  if (days < 30) return "bg-yellow-400";
  return "bg-emerald-400";
}
