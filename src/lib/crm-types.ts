export const ESTAGIOS = [
  "novo_contato",
  "consulta_agendada",
  "em_analise",
  "proposta_enviada",
  "fechado",
  "perdido",
] as const;

export type Estagio = (typeof ESTAGIOS)[number];

export const ESTAGIO_META: Record<
  Estagio,
  { label: string; color: string; dot: string; bg: string; border: string }
> = {
  novo_contato: {
    label: "Novo Contato",
    color: "text-blue-700",
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  consulta_agendada: {
    label: "Consulta Agendada",
    color: "text-yellow-700",
    dot: "bg-yellow-500",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
  },
  em_analise: {
    label: "Em Análise",
    color: "text-orange-700",
    dot: "bg-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  proposta_enviada: {
    label: "Proposta Enviada",
    color: "text-purple-700",
    dot: "bg-purple-500",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  fechado: {
    label: "Fechado",
    color: "text-green-700",
    dot: "bg-green-500",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  perdido: {
    label: "Perdido",
    color: "text-slate-600",
    dot: "bg-slate-400",
    bg: "bg-slate-50",
    border: "border-slate-200",
  },
};

export const ORIGENS = [
  { value: "indicacao", label: "Indicação" },
  { value: "site", label: "Site / Google" },
  { value: "redes_sociais", label: "Redes Sociais" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
] as const;

export const AREAS_INTERESSE = [
  "Previdenciário",
  "Trabalhista",
  "Civil",
  "Criminal",
  "Família",
  "Tributário",
  "Administrativo",
  "Outro",
] as const;

export const TIPOS_ATIVIDADE = [
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "reuniao", label: "Reunião" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "visita", label: "Visita" },
  { value: "outro", label: "Outro" },
] as const;

export type TipoAtividade =
  | "ligacao"
  | "email"
  | "reuniao"
  | "whatsapp"
  | "visita"
  | "outro";

export interface Lead {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  tipo: "PF" | "PJ";
  empresa: string | null;
  area_interesse: string | null;
  estagio: Estagio;
  origem: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  client_id: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  atividades_count: number;
  tarefas_pendentes: number;
}

export interface Atividade {
  id: string;
  lead_id: string;
  tipo: TipoAtividade;
  titulo: string;
  descricao: string | null;
  data_hora: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  created_at: string;
}

export interface Tarefa {
  id: string;
  lead_id: string;
  titulo: string;
  descricao: string | null;
  data_vencimento: string | null;
  concluida: boolean;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  created_at: string;
}
