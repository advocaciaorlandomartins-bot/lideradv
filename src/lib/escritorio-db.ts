import sql from "./db";

export interface EscritorioConfig {
  id: string;
  nome: string;
  oab: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  logo_url: string | null;
  // Typography & page layout
  font_padrao: string;
  tamanho_padrao: number;
  line_height: number;
  margem_topo: number;
  margem_direita: number;
  margem_inferior: number;
  margem_esquerda: number;
  // Letterhead layout
  modelo_timbrado: string;
  // Background letterhead (base64 data URI — PNG, JPG or PDF)
  fundo_timbrado: string | null;
  // Parâmetros financeiros
  salario_minimo: number;
}

export async function getEscritorioConfig(): Promise<EscritorioConfig> {
  const rows = await sql`
    SELECT id::text, nome, oab, cnpj, telefone, email, site,
           endereco, cidade, estado, cep, logo_url,
           font_padrao, tamanho_padrao::float AS tamanho_padrao,
           line_height::float AS line_height,
           margem_topo::float AS margem_topo,
           margem_direita::float AS margem_direita,
           margem_inferior::float AS margem_inferior,
           margem_esquerda::float AS margem_esquerda,
           modelo_timbrado, fundo_timbrado,
           salario_minimo::float AS salario_minimo
    FROM escritorio_config
    LIMIT 1
  `;
  const DEFAULTS = {
    font_padrao: "Times",
    tamanho_padrao: 12,
    line_height: 1.8,
    margem_topo: 25,
    margem_direita: 25,
    margem_inferior: 28,
    margem_esquerda: 25,
    modelo_timbrado: "classico",
    fundo_timbrado: null,
    salario_minimo: 1518.0,
  };

  if (rows.length === 0) {
    return {
      id: "",
      nome: "Advocacia Orlando Martins",
      oab: null,
      cnpj: null,
      telefone: null,
      email: null,
      site: null,
      endereco: null,
      cidade: null,
      estado: null,
      cep: null,
      logo_url: null,
      ...DEFAULTS,
    };
  }
  const r = rows[0];
  return {
    id: r.id,
    nome: r.nome,
    oab: r.oab ?? null,
    cnpj: r.cnpj ?? null,
    telefone: r.telefone ?? null,
    email: r.email ?? null,
    site: r.site ?? null,
    endereco: r.endereco ?? null,
    cidade: r.cidade ?? null,
    estado: r.estado ?? null,
    cep: r.cep ?? null,
    logo_url: r.logo_url ?? null,
    font_padrao: r.font_padrao ?? DEFAULTS.font_padrao,
    tamanho_padrao: r.tamanho_padrao ?? DEFAULTS.tamanho_padrao,
    line_height: r.line_height ?? DEFAULTS.line_height,
    margem_topo: r.margem_topo ?? DEFAULTS.margem_topo,
    margem_direita: r.margem_direita ?? DEFAULTS.margem_direita,
    margem_inferior: r.margem_inferior ?? DEFAULTS.margem_inferior,
    margem_esquerda: r.margem_esquerda ?? DEFAULTS.margem_esquerda,
    modelo_timbrado: r.modelo_timbrado ?? DEFAULTS.modelo_timbrado,
    fundo_timbrado: r.fundo_timbrado ?? null,
    salario_minimo: r.salario_minimo ?? DEFAULTS.salario_minimo,
  };
}
