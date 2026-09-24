/**
 * Tradução CID-10 → descrição em português, pra quem abre o processo
 * entender de cara qual é a condição do cliente sem precisar abrir os
 * documentos anexados. Cobre as categorias (3 primeiros caracteres) mais
 * comuns em processos previdenciários (BPC, aposentadoria por invalidez,
 * auxílio-doença) — não é o CID-10 completo (são +14 mil códigos), é uma
 * tabela pragmática que cresce conforme aparecem casos novos.
 *
 * cid_principal no banco vem como categoria (ex: "F84") ou subcategoria
 * (ex: "F84.0") — normaliza pros 3 primeiros caracteres antes de buscar.
 */
const CID_CATEGORIAS: Record<string, string> = {
  // F00-F09 — Transtornos mentais orgânicos
  F00: "Demência na doença de Alzheimer",
  F01: "Demência vascular",
  F03: "Demência não especificada",
  F06: "Outros transtornos mentais devido a lesão/disfunção cerebral",
  F07: "Transtornos de personalidade devido a doença cerebral",
  // F10-F19 — Transtornos por uso de substância
  F10: "Transtornos mentais por uso de álcool",
  F19: "Transtornos mentais por uso de múltiplas substâncias",
  // F20-F29 — Esquizofrenia e transtornos delirantes
  F20: "Esquizofrenia",
  F21: "Transtorno esquizotípico",
  F25: "Transtorno esquizoafetivo",
  // F30-F39 — Transtornos de humor
  F31: "Transtorno afetivo bipolar",
  F32: "Episódio depressivo",
  F33: "Transtorno depressivo recorrente",
  // F40-F48 — Transtornos neuróticos, de ansiedade e relacionados a estresse
  F40: "Transtornos fóbico-ansiosos",
  F41: "Transtorno de ansiedade",
  F42: "Transtorno obsessivo-compulsivo (TOC)",
  F43: "Reação a estresse grave / transtorno de ajustamento",
  F45: "Transtornos somatoformes",
  // F70-F79 — Retardo mental / deficiência intelectual
  F70: "Deficiência intelectual leve",
  F71: "Deficiência intelectual moderada",
  F72: "Deficiência intelectual grave",
  F73: "Deficiência intelectual profunda",
  F78: "Outra deficiência intelectual",
  F79: "Deficiência intelectual não especificada",
  // F80-F89 — Transtornos do desenvolvimento psicológico
  F84: "Transtorno do Espectro Autista (TEA) / Transtornos globais do desenvolvimento",
  F88: "Outros transtornos do desenvolvimento psicológico",
  F89: "Transtorno do desenvolvimento psicológico não especificado",
  // F90-F98 — Transtornos de comportamento com início na infância/adolescência
  F90: "Transtorno de déficit de atenção e hiperatividade (TDAH)",
  // G00-G09 — Doenças inflamatórias do sistema nervoso central
  G00: "Meningite bacteriana",
  G04: "Encefalite/mielite",
  // G10-G13 — Atrofias sistêmicas do sistema nervoso
  G11: "Ataxia hereditária",
  G12: "Atrofia muscular espinhal e síndromes correlatas",
  // G20-G26 — Doenças extrapiramidais e transtornos do movimento
  G20: "Doença de Parkinson",
  G21: "Parkinsonismo secundário",
  G25: "Outras doenças extrapiramidais e do movimento",
  // G30-G32 — Outras doenças degenerativas do sistema nervoso
  G30: "Doença de Alzheimer",
  G35: "Esclerose múltipla",
  G40: "Epilepsia",
  G43: "Enxaqueca",
  G45: "Ataques isquêmicos cerebrais transitórios",
  G47: "Distúrbios do sono",
  G50: "Transtornos do nervo trigêmeo",
  G56: "Síndrome do túnel do carpo / mononeuropatias do membro superior",
  G80: "Paralisia cerebral",
  G81: "Hemiplegia",
  G82: "Paraplegia e tetraplegia",
  G93: "Outros transtornos do encéfalo",
  // I00-I99 — Doenças do aparelho circulatório
  I10: "Hipertensão essencial",
  I20: "Angina do peito",
  I21: "Infarto agudo do miocárdio",
  I25: "Doença isquêmica crônica do coração",
  I50: "Insuficiência cardíaca",
  I63: "Infarto cerebral (AVC isquêmico)",
  I64: "Acidente Vascular Cerebral (AVC) não especificado",
  I69: "Sequelas de doença cerebrovascular",
  // C00-D48 — Neoplasias (câncer)
  C16: "Neoplasia maligna do estômago",
  C18: "Neoplasia maligna do cólon",
  C34: "Neoplasia maligna dos brônquios e do pulmão",
  C50: "Neoplasia maligna da mama",
  C53: "Neoplasia maligna do colo do útero",
  C61: "Neoplasia maligna da próstata",
  C64: "Neoplasia maligna do rim",
  C71: "Neoplasia maligna do encéfalo",
  C81: "Doença de Hodgkin (linfoma)",
  C91: "Leucemia linfoide",
  // E00-E90 — Doenças endócrinas, nutricionais e metabólicas
  E10: "Diabetes mellitus tipo 1",
  E11: "Diabetes mellitus tipo 2",
  E66: "Obesidade",
  // H00-H59 — Doenças do olho e anexos
  H54: "Cegueira e visão subnormal",
  // H60-H95 — Doenças do ouvido
  H90: "Perda de audição por otite/causas condutivas",
  H91: "Outras perdas de audição",
  // J00-J99 — Doenças do aparelho respiratório
  J44: "Doença pulmonar obstrutiva crônica (DPOC)",
  J45: "Asma",
  // K00-K93 — Doenças do aparelho digestivo
  K70: "Doença hepática alcoólica",
  K74: "Fibrose e cirrose hepática",
  // M00-M99 — Doenças do sistema osteomuscular
  M05: "Artrite reumatoide soropositiva",
  M06: "Outras artrites reumatoides",
  M16: "Coxartrose (artrose do quadril)",
  M17: "Gonartrose (artrose do joelho)",
  M19: "Outras artroses",
  M32: "Lúpus eritematoso sistêmico",
  M47: "Espondilose",
  M48: "Outras espondilopatias",
  M50: "Transtornos de discos cervicais",
  M51: "Outros transtornos de discos intervertebrais (hérnia de disco)",
  M54: "Dorsalgia (dor nas costas)",
  M75: "Lesões do ombro",
  M79: "Outros transtornos dos tecidos moles",
  // N00-N99 — Doenças do aparelho geniturinário
  N18: "Doença renal crônica",
  // Q00-Q99 — Malformações congênitas
  Q90: "Síndrome de Down",
  // S00-T98 — Lesões, envenenamentos e causas externas
  S06: "Traumatismo intracraniano",
  S14: "Traumatismo de nervos e medula espinhal ao nível do pescoço",
  S24: "Traumatismo de nervos e medula espinhal do tórax",
  S34: "Traumatismo de nervos e medula lombar",
  T90: "Sequelas de traumatismos da cabeça",
  T91: "Sequelas de traumatismos do pescoço e tronco",
  T93: "Sequelas de traumatismos do membro inferior",
};

/**
 * Devolve a descrição legível de um código CID-10, ou null se não estiver
 * no dicionário (nesse caso a tela mostra só o código cru).
 */
export function descreverCid(cid: string | null | undefined): string | null {
  if (!cid) return null;
  const categoria = cid.trim().toUpperCase().slice(0, 3);
  return CID_CATEGORIAS[categoria] ?? null;
}
