"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import {
  criarCompromisso,
  atualizarCompromisso,
  deletarCompromisso,
} from "./compromissos-db";
import { agendarNotificacoesCompromisso } from "./lembretes";
import sql from "./db";

// Tipos que disparam notificação automática + tarefa para colaborador
const TIPOS_COM_NOTIFICACAO = new Set([
  "videochamada",
  "reuniao",
  "fechamento",
  "consulta",
]);

interface CompromissoData {
  titulo: string;
  tipo: string;
  dataInicio: string;
  horaInicio: string | null;
  horaFim: string | null;
  localLink: string | null;
  descricao: string | null;
  status?: string;
  clienteId?: string | null;
  responsavelLogin?: string | null;
}

export async function criarCompromissoAction(
  data: CompromissoData
): Promise<{ id: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "criar"))
    throw new Error("Não autenticado");

  const id = await criarCompromisso({ ...data, criadoPor: session.login });

  // Notificações e tarefa automática para tipos relevantes
  if (TIPOS_COM_NOTIFICACAO.has(data.tipo)) {
    const dataEvento = new Date(data.dataInicio + "T12:00:00");
    if (dataEvento > new Date()) {
      // Usa o responsável escolhido no modal, senão o usuário da sessão
      const loginEfetivo = data.responsavelLogin || session.login;

      // Busca dados do colaborador e do cliente em paralelo
      const [colaboradorRows, clienteRows, usuarioRows] = await Promise.all([
        sql`
          SELECT col.nome, col.telefone
          FROM colaboradores col
          JOIN usuarios u ON u.colaborador_id = col.id
          WHERE u.login = ${loginEfetivo} AND col.status = 'ativo'
          LIMIT 1
        `.catch(() => [] as Record<string, unknown>[]),
        data.clienteId
          ? sql`
              SELECT id::text, name, phone, menor_incapaz, responsavel_nome, responsavel_telefone
              FROM clients WHERE id = ${data.clienteId}::uuid LIMIT 1
            `.catch(() => [] as Record<string, unknown>[])
          : Promise.resolve([] as Record<string, unknown>[]),
        sql`
          SELECT id::text FROM usuarios WHERE login = ${loginEfetivo} LIMIT 1
        `.catch(() => [] as Record<string, unknown>[]),
      ]);

      const colaborador =
        colaboradorRows.length > 0 && colaboradorRows[0].telefone
          ? {
              nome: String(colaboradorRows[0].nome ?? session.login),
              telefone: String(colaboradorRows[0].telefone),
            }
          : null;

      const clienteRow = clienteRows.length > 0 ? clienteRows[0] : null;
      const cliente =
        clienteRow && clienteRow.phone
          ? {
              id: String(clienteRow.id),
              nome: String(clienteRow.name),
              telefone: String(clienteRow.phone),
            }
          : null;
      // Responsável legal do cliente (menor/incapaz) — mensagens vão a ele.
      // Só redireciona quando o cliente é efetivamente menor/incapaz —
      // um contato de emergência cadastrado não deve desviar as mensagens
      // de um cliente adulto.
      const clienteResponsavel =
        clienteRow?.menor_incapaz &&
        clienteRow?.responsavel_nome &&
        clienteRow?.responsavel_telefone
          ? {
              nome: String(clienteRow.responsavel_nome),
              telefone: String(clienteRow.responsavel_telefone),
            }
          : null;

      // Detecta link de videochamada no campo localLink
      const link = data.localLink?.startsWith("http") ? data.localLink : null;

      // Agenda notificações WhatsApp (colaborador + cliente/responsável)
      await agendarNotificacoesCompromisso({
        compromissoId: id,
        titulo: data.titulo,
        tipo: data.tipo,
        dataEvento,
        hora: data.horaInicio,
        local: link ? null : data.localLink,
        link,
        colaborador,
        cliente,
        clienteResponsavel,
      }).catch((e) => {
        console.error(
          "[criarCompromissoAction] falha ao agendar notificações:",
          e
        );
        return null;
      });

      // Cria entrada em controles → aparece em Minhas Tarefas do colaborador
      if (usuarioRows.length > 0) {
        const usuarioId = String(usuarioRows[0].id);
        const tipoLabel: Record<string, string> = {
          videochamada: "Videochamada",
          reuniao: "Reunião",
          fechamento: "Fechamento",
          consulta: "Consulta",
        };
        const descricao = `${tipoLabel[data.tipo] ?? data.tipo}: ${data.titulo}${
          cliente ? ` — ${cliente.nome}` : ""
        }`;

        await sql`
          INSERT INTO controles
            (tipo, data_evento, descricao, responsavel_id, cliente_id,
             tipo_demanda, prioridade)
          VALUES
            ('agenda',
             ${data.dataInicio}::date,
             ${descricao},
             ${usuarioId}::uuid,
             ${data.clienteId ? sql`${data.clienteId}::uuid` : sql`NULL`},
             ${data.titulo},
             'normal')
        `.catch((e) => {
          console.error(
            "[criarCompromissoAction] falha ao inserir controle/tarefa:",
            e
          );
          return null;
        });
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  return { id };
}

// Compromissos são a agenda PESSOAL de cada colaborador (listarCompromissos*
// já filtra por criado_por) — só o dono do compromisso ou um Admin/Sócio
// pode editar/excluir. Sem isso, qualquer usuário com controles:editar
// (Advogado(a)/Estagiário(a) por padrão) conseguia alterar/apagar a agenda
// de qualquer colega só sabendo o UUID.
function podeGerenciarTodosCompromissos(categoria: string): boolean {
  return categoria === "Administrador(a)" || categoria === "Sócio(a)";
}

export async function atualizarCompromissoAction(
  id: string,
  data: CompromissoData
): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "editar"))
    throw new Error("Não autenticado");

  if (!podeGerenciarTodosCompromissos(session.categoria)) {
    const [row] = await sql`
      SELECT criado_por FROM compromissos WHERE id = ${id}::uuid
    `;
    if (!row || row.criado_por !== session.login) {
      throw new Error("Sem permissão para editar este compromisso.");
    }
  }

  await atualizarCompromisso(id, data);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

export async function deletarCompromissoAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "excluir"))
    throw new Error("Não autenticado");

  if (!podeGerenciarTodosCompromissos(session.categoria)) {
    const [row] = await sql`
      SELECT criado_por FROM compromissos WHERE id = ${id}::uuid
    `;
    if (!row || row.criado_por !== session.login) {
      throw new Error("Sem permissão para excluir este compromisso.");
    }
  }

  await deletarCompromisso(id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}
