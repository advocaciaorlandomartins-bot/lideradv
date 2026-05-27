"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";

export type ControleFormState = { error?: string; success?: boolean } | null;

async function buildDadosAudiencia(formData: FormData): Promise<string | null> {
  const hora = ((formData.get("hora") as string) ?? "").trim() || null;
  const linkVirtual =
    ((formData.get("link_virtual") as string) ?? "").trim() || null;
  const localMode = (formData.get("local_mode") as string) ?? "existente";
  let localId = ((formData.get("local_id") as string) ?? "").trim() || null;
  let localTitulo: string | null = null;

  if (localMode === "novo") {
    const novoTitulo =
      ((formData.get("novo_local_titulo") as string) ?? "").trim() || null;
    const novoEndereco =
      ((formData.get("novo_local_endereco") as string) ?? "").trim() || null;
    const novoMapa =
      ((formData.get("novo_local_mapa") as string) ?? "").trim() || null;
    if (novoTitulo) {
      const rows = await sql`
        INSERT INTO locais_audiencia (titulo, endereco, mapa_url)
        VALUES (${novoTitulo}, ${novoEndereco}, ${novoMapa})
        ON CONFLICT (titulo) DO UPDATE SET titulo = EXCLUDED.titulo
        RETURNING id::text, titulo
      `;
      localId = String(rows[0].id);
      localTitulo = String(rows[0].titulo);
    }
  } else if (localId === "outro") {
    const outroTexto =
      ((formData.get("local_outro_texto") as string) ?? "").trim() || null;
    localTitulo = outroTexto;
    localId = null;
  } else if (localId) {
    const rows = await sql`
      SELECT titulo FROM locais_audiencia WHERE id = ${localId}::uuid
    `;
    localTitulo = rows[0]?.titulo ? String(rows[0].titulo) : null;
  }

  const dados: Record<string, string | null> = {
    hora,
    link_virtual: linkVirtual,
    local_id: localId,
    local_titulo: localTitulo,
  };

  const hasDados = Object.values(dados).some((v) => v !== null);
  return hasDados ? JSON.stringify(dados) : null;
}

async function buildDadosPericia(formData: FormData): Promise<string | null> {
  const hora = ((formData.get("hora") as string) ?? "").trim() || null;
  const tipoPericia =
    ((formData.get("tipo_pericia") as string) ?? "").trim() || null;
  let localId = ((formData.get("local_id") as string) ?? "").trim() || null;
  let localTitulo: string | null = null;

  if (localId === "outro") {
    const outroTexto =
      ((formData.get("local_outro_texto") as string) ?? "").trim() || null;
    localTitulo = outroTexto;
    localId = null;
  } else if (localId) {
    const rows = await sql`
      SELECT titulo FROM locais_pericia WHERE id = ${localId}::uuid
    `;
    localTitulo = rows[0]?.titulo ? String(rows[0].titulo) : null;
  }

  const dados: Record<string, string | null> = {
    hora,
    tipo_pericia: tipoPericia,
    local_id: localId,
    local_titulo: localTitulo,
  };

  const hasDados = Object.values(dados).some((v) => v !== null);
  return hasDados ? JSON.stringify(dados) : null;
}

export async function createControleAction(
  _prev: ControleFormState,
  formData: FormData
): Promise<ControleFormState> {
  const tipo = (formData.get("tipo") as string) ?? "";
  const dataEvento =
    ((formData.get("data_evento") as string) ?? "").trim() || null;
  const prazoInterno =
    ((formData.get("prazo_interno") as string) ?? "").trim() || null;
  const descricao = ((formData.get("descricao") as string) ?? "").trim();
  const clienteId =
    ((formData.get("cliente_id") as string) ?? "").trim() || null;
  const processoId =
    ((formData.get("processo_id") as string) ?? "").trim() || null;
  const responsavelId =
    ((formData.get("responsavel_id") as string) ?? "").trim() || null;
  const tipoDemanda =
    ((formData.get("tipo_demanda") as string) ?? "").trim() || null;
  const observacoes =
    ((formData.get("observacoes") as string) ?? "").trim() || null;

  if (!tipo) return { error: "Tipo de controle obrigatório." };
  if (tipo !== "audiencias" && tipo !== "pericias" && !descricao)
    return { error: "Descrição é obrigatória." };

  let dadosJson: string | null = null;
  try {
    if (tipo === "audiencias") dadosJson = await buildDadosAudiencia(formData);
    else if (tipo === "pericias") dadosJson = await buildDadosPericia(formData);
  } catch (err) {
    console.error("buildDadosAudiencia:", err);
    return { error: "Erro ao processar dados da audiência." };
  }

  try {
    if (clienteId && processoId && responsavelId) {
      await sql`
        INSERT INTO controles (tipo, data_evento, prazo_interno, descricao, cliente_id, processo_id, responsavel_id, tipo_demanda, observacoes, dados)
        VALUES (${tipo}, ${dataEvento}::date, ${prazoInterno}::date, ${descricao}, ${clienteId}::uuid, ${processoId}::uuid, ${responsavelId}::uuid, ${tipoDemanda}, ${observacoes}, ${dadosJson}::jsonb)
      `;
    } else if (clienteId && processoId) {
      await sql`
        INSERT INTO controles (tipo, data_evento, prazo_interno, descricao, cliente_id, processo_id, tipo_demanda, observacoes, dados)
        VALUES (${tipo}, ${dataEvento}::date, ${prazoInterno}::date, ${descricao}, ${clienteId}::uuid, ${processoId}::uuid, ${tipoDemanda}, ${observacoes}, ${dadosJson}::jsonb)
      `;
    } else if (clienteId && responsavelId) {
      await sql`
        INSERT INTO controles (tipo, data_evento, prazo_interno, descricao, cliente_id, responsavel_id, tipo_demanda, observacoes, dados)
        VALUES (${tipo}, ${dataEvento}::date, ${prazoInterno}::date, ${descricao}, ${clienteId}::uuid, ${responsavelId}::uuid, ${tipoDemanda}, ${observacoes}, ${dadosJson}::jsonb)
      `;
    } else if (clienteId) {
      await sql`
        INSERT INTO controles (tipo, data_evento, prazo_interno, descricao, cliente_id, tipo_demanda, observacoes, dados)
        VALUES (${tipo}, ${dataEvento}::date, ${prazoInterno}::date, ${descricao}, ${clienteId}::uuid, ${tipoDemanda}, ${observacoes}, ${dadosJson}::jsonb)
      `;
    } else {
      await sql`
        INSERT INTO controles (tipo, data_evento, prazo_interno, descricao, tipo_demanda, observacoes, dados)
        VALUES (${tipo}, ${dataEvento}::date, ${prazoInterno}::date, ${descricao}, ${tipoDemanda}, ${observacoes}, ${dadosJson}::jsonb)
      `;
    }
  } catch (err) {
    console.error("createControleAction:", err);
    return { error: "Erro ao criar controle." };
  }

  revalidatePath("/dashboard/controles");
  return { success: true };
}

export async function updateControleAction(
  _prev: ControleFormState,
  formData: FormData
): Promise<ControleFormState> {
  const id = (formData.get("id") as string) ?? "";
  const tipo = (formData.get("tipo") as string) ?? "";
  const dataEvento =
    ((formData.get("data_evento") as string) ?? "").trim() || null;
  const prazoInterno =
    ((formData.get("prazo_interno") as string) ?? "").trim() || null;
  const descricao = ((formData.get("descricao") as string) ?? "").trim();
  const status = ((formData.get("status") as string) ?? "").trim() || null;
  const clienteId =
    ((formData.get("cliente_id") as string) ?? "").trim() || null;
  const processoId =
    ((formData.get("processo_id") as string) ?? "").trim() || null;
  const responsavelId =
    ((formData.get("responsavel_id") as string) ?? "").trim() || null;
  const tipoDemanda =
    ((formData.get("tipo_demanda") as string) ?? "").trim() || null;
  const observacoes =
    ((formData.get("observacoes") as string) ?? "").trim() || null;

  if (!id) return { error: "ID inválido." };
  if (!tipo) return { error: "Tipo obrigatório." };
  if (tipo !== "audiencias" && tipo !== "pericias" && !descricao)
    return { error: "Descrição é obrigatória." };

  const dbStatus = status === "pendente" || !status ? null : status;

  let dadosJson: string | null = null;
  try {
    if (tipo === "audiencias") dadosJson = await buildDadosAudiencia(formData);
    else if (tipo === "pericias") dadosJson = await buildDadosPericia(formData);
  } catch (err) {
    console.error("buildDadosAudiencia:", err);
    return { error: "Erro ao processar dados da audiência." };
  }

  try {
    if (clienteId && processoId && responsavelId) {
      await sql`
        UPDATE controles SET
          tipo = ${tipo}, data_evento = ${dataEvento}::date, prazo_interno = ${prazoInterno}::date,
          descricao = ${descricao}, status = ${dbStatus}, cliente_id = ${clienteId}::uuid,
          processo_id = ${processoId}::uuid, responsavel_id = ${responsavelId}::uuid,
          tipo_demanda = ${tipoDemanda}, observacoes = ${observacoes},
          dados = ${dadosJson}::jsonb, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    } else if (clienteId && processoId) {
      await sql`
        UPDATE controles SET
          tipo = ${tipo}, data_evento = ${dataEvento}::date, prazo_interno = ${prazoInterno}::date,
          descricao = ${descricao}, status = ${dbStatus}, cliente_id = ${clienteId}::uuid,
          processo_id = ${processoId}::uuid, responsavel_id = NULL,
          tipo_demanda = ${tipoDemanda}, observacoes = ${observacoes},
          dados = ${dadosJson}::jsonb, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    } else if (clienteId) {
      await sql`
        UPDATE controles SET
          tipo = ${tipo}, data_evento = ${dataEvento}::date, prazo_interno = ${prazoInterno}::date,
          descricao = ${descricao}, status = ${dbStatus}, cliente_id = ${clienteId}::uuid,
          processo_id = NULL, responsavel_id = NULL,
          tipo_demanda = ${tipoDemanda}, observacoes = ${observacoes},
          dados = ${dadosJson}::jsonb, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    } else {
      await sql`
        UPDATE controles SET
          tipo = ${tipo}, data_evento = ${dataEvento}::date, prazo_interno = ${prazoInterno}::date,
          descricao = ${descricao}, status = ${dbStatus},
          cliente_id = NULL, processo_id = NULL, responsavel_id = NULL,
          tipo_demanda = ${tipoDemanda}, observacoes = ${observacoes},
          dados = ${dadosJson}::jsonb, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    }
  } catch (err) {
    console.error("updateControleAction:", err);
    return { error: "Erro ao atualizar controle." };
  }

  revalidatePath("/dashboard/controles");
  return { success: true };
}

export async function updateStatusControleAction(
  id: string,
  novoStatus: "concluido" | "cancelado" | "pendente"
): Promise<void> {
  const dbStatus = novoStatus === "pendente" ? null : novoStatus;
  await sql`UPDATE controles SET status = ${dbStatus}, updated_at = NOW() WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/controles");
}

export async function deleteControleAction(id: string): Promise<void> {
  await sql`DELETE FROM controles WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/controles");
}
