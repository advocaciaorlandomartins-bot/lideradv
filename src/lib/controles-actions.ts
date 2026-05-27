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

function subtractDays(dateStr: string, days: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function insertOrUpdateLinkedControle(params: {
  existingId: string | null;
  tipo: string;
  dataEvento: string;
  descricao: string;
  clienteId: string | null;
  processoId: string | null;
  responsavelId: string | null;
  tipoDemanda: string | null;
}): Promise<string> {
  const {
    existingId,
    tipo,
    dataEvento,
    descricao,
    clienteId,
    processoId,
    responsavelId,
    tipoDemanda,
  } = params;

  if (existingId) {
    await sql`UPDATE controles SET data_evento = ${dataEvento}::date, updated_at = NOW() WHERE id = ${existingId}::uuid`;
    return existingId;
  }

  let rows;
  if (clienteId && processoId && responsavelId) {
    rows = await sql`
      INSERT INTO controles (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, tipo_demanda)
      VALUES (${tipo}, ${dataEvento}::date, ${descricao}, ${clienteId}::uuid, ${processoId}::uuid, ${responsavelId}::uuid, ${tipoDemanda})
      RETURNING id::text
    `;
  } else if (clienteId && processoId) {
    rows = await sql`
      INSERT INTO controles (tipo, data_evento, descricao, cliente_id, processo_id, tipo_demanda)
      VALUES (${tipo}, ${dataEvento}::date, ${descricao}, ${clienteId}::uuid, ${processoId}::uuid, ${tipoDemanda})
      RETURNING id::text
    `;
  } else if (clienteId && responsavelId) {
    rows = await sql`
      INSERT INTO controles (tipo, data_evento, descricao, cliente_id, responsavel_id, tipo_demanda)
      VALUES (${tipo}, ${dataEvento}::date, ${descricao}, ${clienteId}::uuid, ${responsavelId}::uuid, ${tipoDemanda})
      RETURNING id::text
    `;
  } else if (clienteId) {
    rows = await sql`
      INSERT INTO controles (tipo, data_evento, descricao, cliente_id, tipo_demanda)
      VALUES (${tipo}, ${dataEvento}::date, ${descricao}, ${clienteId}::uuid, ${tipoDemanda})
      RETURNING id::text
    `;
  } else {
    rows = await sql`
      INSERT INTO controles (tipo, data_evento, descricao, tipo_demanda)
      VALUES (${tipo}, ${dataEvento}::date, ${descricao}, ${tipoDemanda})
      RETURNING id::text
    `;
  }
  return String(rows[0].id);
}

async function buildDadosImplantadosData(
  formData: FormData,
  clienteId: string | null,
  processoId: string | null,
  responsavelId: string | null,
  tipoDemanda: string | null,
  descricao: string
): Promise<string | null> {
  const data1pag = ((formData.get("data_1pag") as string) ?? "").trim() || null;
  const dataCessacao =
    ((formData.get("data_cessacao") as string) ?? "").trim() || null;
  const existingImplantadosId =
    ((formData.get("implantados_id") as string) ?? "").trim() || null;
  const existingDcbId =
    ((formData.get("dcb_id") as string) ?? "").trim() || null;

  let implantadosId: string | null = existingImplantadosId;
  let dcbId: string | null = existingDcbId;

  if (data1pag) {
    implantadosId = await insertOrUpdateLinkedControle({
      existingId: existingImplantadosId,
      tipo: "implantados",
      dataEvento: data1pag,
      descricao: descricao || "Benefício implantado (1° Pagamento)",
      clienteId,
      processoId,
      responsavelId,
      tipoDemanda,
    });
  }

  if (dataCessacao) {
    const dcbData = subtractDays(dataCessacao, 15);
    dcbId = await insertOrUpdateLinkedControle({
      existingId: existingDcbId,
      tipo: "dcb",
      dataEvento: dcbData,
      descricao: descricao || "DCB — Prorrogação automática",
      clienteId,
      processoId,
      responsavelId,
      tipoDemanda,
    });
  }

  const dados: Record<string, string | null> = {
    data_1pag: data1pag,
    data_cessacao: dataCessacao,
    implantados_id: implantadosId,
    dcb_id: dcbId,
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
  if (
    tipo !== "audiencias" &&
    tipo !== "pericias" &&
    tipo !== "implantados-data" &&
    tipo !== "dcb" &&
    !descricao
  )
    return { error: "Descrição é obrigatória." };

  let dadosJson: string | null = null;
  try {
    if (tipo === "audiencias") dadosJson = await buildDadosAudiencia(formData);
    else if (tipo === "pericias") dadosJson = await buildDadosPericia(formData);
    else if (tipo === "implantados-data")
      dadosJson = await buildDadosImplantadosData(
        formData,
        clienteId,
        processoId,
        responsavelId,
        tipoDemanda,
        descricao
      );
  } catch (err) {
    console.error("buildDados:", err);
    return { error: "Erro ao processar dados." };
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
  if (
    tipo !== "audiencias" &&
    tipo !== "pericias" &&
    tipo !== "implantados-data" &&
    tipo !== "dcb" &&
    !descricao
  )
    return { error: "Descrição é obrigatória." };

  const dbStatus = status === "pendente" || !status ? null : status;

  let dadosJson: string | null = null;
  try {
    if (tipo === "audiencias") dadosJson = await buildDadosAudiencia(formData);
    else if (tipo === "pericias") dadosJson = await buildDadosPericia(formData);
    else if (tipo === "implantados-data")
      dadosJson = await buildDadosImplantadosData(
        formData,
        clienteId,
        processoId,
        responsavelId,
        tipoDemanda,
        descricao
      );
  } catch (err) {
    console.error("buildDados:", err);
    return { error: "Erro ao processar dados." };
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
