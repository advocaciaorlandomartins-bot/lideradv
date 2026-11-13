"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { podeAcessarPericia } from "./acesso";
import { logAction } from "./audit";
import { sincronizarCompromissoDaPericia } from "./pericia-agenda-sync";
import { criarNovoAgendamentoPericia } from "./pericia-novo-agendamento";
import { criarNovoAgendamentoPericiaJudicial } from "./pericia-judicial-agendamento";
import { TIPO_LABELS, type TipoPericia } from "./pericias-types";

export type PericiaFormState = { error: string } | null;

function getFields(formData: FormData) {
  return {
    tipo: ((formData.get("tipo") as string | null) ?? "").trim(),
    clientId: ((formData.get("client_id") as string | null) ?? "").trim(),
    processoId:
      ((formData.get("processo_id") as string | null) ?? "").trim() || null,
    dataPericia: ((formData.get("data_pericia") as string | null) ?? "").trim(),
    horaPericia:
      ((formData.get("hora_pericia") as string | null) ?? "").trim() || null,
    localPericia:
      ((formData.get("local_pericia") as string | null) ?? "").trim() || null,
    perito: ((formData.get("perito") as string | null) ?? "").trim() || null,
    especialidade:
      ((formData.get("especialidade") as string | null) ?? "").trim() || null,
    status: ((formData.get("status") as string | null) ?? "agendado").trim(),
    resultado:
      ((formData.get("resultado") as string | null) ?? "").trim() || null,
    beneficioNumero:
      ((formData.get("beneficio_numero") as string | null) ?? "").trim() ||
      null,
    beneficioTipo:
      ((formData.get("beneficio_tipo") as string | null) ?? "").trim() || null,
    dataFimBeneficio:
      (formData.get("data_fim_beneficio") as string | null) || null,
    novaDataFim: (formData.get("nova_data_fim") as string | null) || null,
    observacoes:
      ((formData.get("observacoes") as string | null) ?? "").trim() || null,
  };
}

const TIPOS_ADMINISTRATIVOS = new Set([
  "pericia_administrativa",
  "avaliacao_social_administrativa",
]);
const TIPOS_JUDICIAIS = new Set([
  "pericia_judicial",
  "avaliacao_social_judicial",
]);

export async function createPericiaAction(
  _prev: PericiaFormState,
  formData: FormData
): Promise<PericiaFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "criar"))
    return { error: "Sem permissão." };

  const f = getFields(formData);

  if (!f.tipo) return { error: "Selecione o tipo de perícia." };
  if (!f.clientId) return { error: "Selecione o cliente." };
  if (!f.dataPericia) return { error: "Informe a data da perícia." };

  // Agendamento novo "pra frente" (status agendado) ganha o pipeline
  // completo — compromisso na Agenda, lembretes automáticos por WhatsApp —
  // igual ao que a Íris já faz. Backfill de registro histórico (realizado/
  // remarcado/cancelado, tipicamente digitado bem depois do fato) continua
  // como puro registro em Controles, sem reabrir aviso de algo que já
  // aconteceu. Achado real (2026-11-13): esta tela nunca teve esse pipeline
  // pra NENHUM tipo — só a Íris (chat/WhatsApp) criava Agenda+lembrete.
  if (f.status === "agendado") {
    if (TIPOS_ADMINISTRATIVOS.has(f.tipo)) {
      const resultado = await criarNovoAgendamentoPericia({
        clienteId: f.clientId,
        tipoPericia: f.tipo as
          | "pericia_administrativa"
          | "avaliacao_social_administrativa",
        tipoServico: TIPO_LABELS[f.tipo as TipoPericia] ?? f.tipo,
        data: f.dataPericia,
        hora: f.horaPericia ?? "09:00",
        local: f.localPericia ?? "A definir",
        processoId: f.processoId,
        perito: f.perito,
        especialidade: f.especialidade,
        observacoes: f.observacoes,
        criadoPorLogin: session.login,
        criadoPorUserId: session.id,
      }).catch((e) => {
        console.error("[createPericiaAction] falha ao agendar:", e);
        return { ok: false, erro: "Erro ao salvar perícia. Tente novamente." };
      });
      if (!resultado.ok) return { error: resultado.erro ?? "Erro ao salvar." };

      await logAction({
        acao: "criar",
        entidade: "pericia",
        descricao: `Cadastrou perícia: ${f.tipo}`,
        detalhes: { tipo: f.tipo, data: f.dataPericia },
      });
      redirect("/dashboard/pericias");
    }

    if (TIPOS_JUDICIAIS.has(f.tipo)) {
      const resultado = await criarNovoAgendamentoPericiaJudicial({
        clienteId: f.clientId,
        tipo: f.tipo as "pericia_judicial" | "avaliacao_social_judicial",
        data: f.dataPericia,
        hora: f.horaPericia ?? "09:00",
        local: f.localPericia ?? "A definir",
        processoId: f.processoId,
        perito: f.perito,
        especialidade: f.especialidade,
        observacoes: f.observacoes,
        criadoPorLogin: session.login,
        criadoPorUserId: session.id,
      }).catch((e) => {
        console.error("[createPericiaAction] falha ao agendar judicial:", e);
        return { ok: false, erro: "Erro ao salvar perícia. Tente novamente." };
      });
      if (!resultado.ok) return { error: resultado.erro ?? "Erro ao salvar." };

      await logAction({
        acao: "criar",
        entidade: "pericia",
        descricao: `Cadastrou perícia: ${f.tipo}`,
        detalhes: { tipo: f.tipo, data: f.dataPericia },
      });
      redirect("/dashboard/pericias");
    }
  }

  // Prorrogação de benefício, ou qualquer tipo fora do status "agendado"
  // (backfill histórico): registro simples, sem Agenda/lembrete — mesmo
  // comportamento de sempre.
  let compromissoIdProrrogacao: string | null = null;
  try {
    if (f.tipo === "prorrogacao_beneficio" && f.status === "agendado") {
      const [cliente] = await sql`
        SELECT name FROM clients WHERE id = ${f.clientId}::uuid
      `;
      const clienteNome = cliente?.name ? String(cliente.name) : "Cliente";
      const [compromisso] = await sql`
        INSERT INTO compromissos
          (titulo, tipo, data_inicio, criado_por, cliente_id, descricao)
        VALUES
          (${`Prorrogação de benefício — ${clienteNome}`}, 'outro',
           ${f.dataPericia}::date, ${session.login}, ${f.clientId}::uuid,
           ${f.observacoes})
        RETURNING id::text
      `;
      compromissoIdProrrogacao = String(compromisso.id);
    }

    await sql`
      INSERT INTO pericias (
        tipo, client_id, processo_id, data_pericia, hora_pericia,
        local_pericia, perito, especialidade, status, resultado,
        beneficio_numero, beneficio_tipo,
        data_fim_beneficio, nova_data_fim, observacoes, compromisso_id
      ) VALUES (
        ${f.tipo},
        ${f.clientId}::uuid,
        ${f.processoId ? f.processoId : null}::uuid,
        ${f.dataPericia}::date,
        ${f.horaPericia ? f.horaPericia : null}::time,
        ${f.localPericia}, ${f.perito}, ${f.especialidade},
        ${f.status}, ${f.resultado},
        ${f.beneficioNumero}, ${f.beneficioTipo},
        ${f.dataFimBeneficio ? f.dataFimBeneficio : null}::date,
        ${f.novaDataFim ? f.novaDataFim : null}::date,
        ${f.observacoes}, ${compromissoIdProrrogacao}::uuid
      )
    `;
  } catch (err) {
    console.error("createPericiaAction DB error:", err);
    return { error: "Erro ao salvar perícia. Tente novamente." };
  }

  if (compromissoIdProrrogacao) {
    try {
      const [escritorio] =
        await sql`SELECT nome, telefone FROM escritorio_config LIMIT 1`;
      const telefoneEscritorio = String(escritorio?.telefone ?? "").trim();
      if (telefoneEscritorio) {
        const { agendarLembretesCompromissoPrevBot } =
          await import("./lembretes");
        const [cliente] = await sql`
          SELECT name FROM clients WHERE id = ${f.clientId}::uuid
        `;
        await agendarLembretesCompromissoPrevBot({
          compromissoId: compromissoIdProrrogacao,
          titulo: `Prorrogação de benefício — ${cliente?.name ? String(cliente.name) : "Cliente"}`,
          dataEvento: new Date(f.dataPericia + "T12:00:00"),
          hora: null,
          local: null,
          colaboradorTelefone: telefoneEscritorio,
          colaboradorNome: String(escritorio?.nome ?? "Escritório"),
          clienteNome: cliente?.name ? String(cliente.name) : "Cliente",
        });
      }
    } catch (e) {
      console.error(
        "[createPericiaAction] falha ao agendar lembrete de prorrogação:",
        e
      );
    }
  }

  await logAction({
    acao: "criar",
    entidade: "pericia",
    descricao: `Cadastrou perícia: ${f.tipo}`,
    detalhes: { tipo: f.tipo, data: f.dataPericia },
  });

  redirect("/dashboard/pericias");
}

export async function updatePericiaAction(
  id: string,
  _prev: PericiaFormState,
  formData: FormData
): Promise<PericiaFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "editar"))
    return { error: "Sem permissão." };
  // Checagem de módulo acima é só "tem acesso a Controles" — sem isto,
  // qualquer colaborador com permissão de editar controles podia editar a
  // perícia de QUALQUER outro colega, de qualquer processo, só sabendo o
  // UUID (achado em auditoria de segurança 2026-10-15; mesmo padrão já
  // corrigido pra processos/clientes/leads, faltava aqui).
  if (!(await podeAcessarPericia(session, id)))
    return { error: "Sem permissão." };

  const f = getFields(formData);

  if (!f.tipo) return { error: "Selecione o tipo de perícia." };
  if (!f.clientId) return { error: "Selecione o cliente." };
  if (!f.dataPericia) return { error: "Informe a data da perícia." };

  // Só dispara a remarcação (sincroniza agenda + avisa cliente) se algo que
  // afeta o compromisso de fato mudou — não a cada edição de observação.
  const [antes] = await sql`
    SELECT data_pericia::text, hora_pericia::text, local_pericia
    FROM pericias WHERE id = ${id}::uuid
  `.catch(
    () =>
      [] as {
        data_pericia: string;
        hora_pericia: string | null;
        local_pericia: string | null;
      }[]
  );
  const remarcou =
    !!antes &&
    (antes.data_pericia !== f.dataPericia ||
      (antes.hora_pericia?.slice(0, 5) ?? null) !== f.horaPericia ||
      antes.local_pericia !== f.localPericia);

  try {
    await sql`
      UPDATE pericias SET
        tipo               = ${f.tipo},
        client_id          = ${f.clientId}::uuid,
        processo_id        = ${f.processoId ? f.processoId : null}::uuid,
        data_pericia       = ${f.dataPericia}::date,
        hora_pericia       = ${f.horaPericia ? f.horaPericia : null}::time,
        local_pericia      = ${f.localPericia},
        perito             = ${f.perito},
        especialidade      = ${f.especialidade},
        status             = ${f.status},
        resultado          = ${f.resultado},
        beneficio_numero   = ${f.beneficioNumero},
        beneficio_tipo     = ${f.beneficioTipo},
        data_fim_beneficio = ${f.dataFimBeneficio ? f.dataFimBeneficio : null}::date,
        nova_data_fim      = ${f.novaDataFim ? f.novaDataFim : null}::date,
        observacoes        = ${f.observacoes},
        updated_at         = NOW()
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("updatePericiaAction DB error:", err);
    return { error: "Erro ao atualizar perícia. Tente novamente." };
  }

  await logAction({
    acao: "editar",
    entidade: "pericia",
    entidadeId: id,
    descricao: `Editou perícia: ${f.tipo}`,
  });

  if (remarcou) {
    await sincronizarCompromissoDaPericia(id).catch((err) => {
      console.error("[updatePericiaAction] falha ao sincronizar agenda:", err);
      return null;
    });
  }

  redirect(`/dashboard/pericias/${id}`);
}

export async function markPericiaRealizadaAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "editar"))
    return { error: "Sem permissão." };
  if (!(await podeAcessarPericia(session, id)))
    return { error: "Sem permissão." };

  try {
    await sql`
      UPDATE pericias SET status = 'realizado', updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("markPericiaRealizadaAction DB error:", err);
    return { error: "Erro ao marcar perícia como realizada." };
  }
  await logAction({
    acao: "editar",
    entidade: "pericia",
    entidadeId: id,
    descricao: "Marcou perícia como realizada",
  });
  revalidatePath("/dashboard/pericias");
  return {};
}

export async function deletePericiaAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "excluir"))
    return { error: "Sem permissão." };
  if (!(await podeAcessarPericia(session, id)))
    return { error: "Sem permissão." };

  try {
    await sql`DELETE FROM pericias WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deletePericiaAction DB error:", err);
    return { error: "Erro ao excluir perícia. Tente novamente." };
  }
  await logAction({
    acao: "excluir",
    entidade: "pericia",
    entidadeId: id,
    descricao: "Excluiu perícia",
  });
  redirect("/dashboard/pericias");
}
