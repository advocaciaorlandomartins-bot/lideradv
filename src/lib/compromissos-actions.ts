"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
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
}

export async function criarCompromissoAction(
  data: CompromissoData
): Promise<{ id: string }> {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");

  const id = await criarCompromisso({ ...data, criadoPor: session.login });

  // Notificações e tarefa automática para tipos relevantes
  if (TIPOS_COM_NOTIFICACAO.has(data.tipo)) {
    const dataEvento = new Date(data.dataInicio + "T12:00:00");
    if (dataEvento > new Date()) {
      // Busca dados do colaborador e do cliente em paralelo
      const [colaboradorRows, clienteRows, usuarioRows] = await Promise.all([
        sql`
          SELECT col.nome, col.telefone
          FROM colaboradores col
          JOIN usuarios u ON u.colaborador_id = col.id
          WHERE u.login = ${session.login} AND col.status = 'ativo'
          LIMIT 1
        `.catch(() => [] as Record<string, unknown>[]),
        data.clienteId
          ? sql`
              SELECT id::text, name, phone FROM clients
              WHERE id = ${data.clienteId}::uuid LIMIT 1
            `.catch(() => [] as Record<string, unknown>[])
          : Promise.resolve([] as Record<string, unknown>[]),
        sql`
          SELECT id::text FROM usuarios WHERE login = ${session.login} LIMIT 1
        `.catch(() => [] as Record<string, unknown>[]),
      ]);

      const colaborador =
        colaboradorRows.length > 0 && colaboradorRows[0].telefone
          ? {
              nome: String(colaboradorRows[0].nome ?? session.login),
              telefone: String(colaboradorRows[0].telefone),
            }
          : null;

      const cliente =
        clienteRows.length > 0 && clienteRows[0].phone
          ? {
              id: String(clienteRows[0].id),
              nome: String(clienteRows[0].name),
              telefone: String(clienteRows[0].phone),
            }
          : null;

      // Detecta link de videochamada no campo localLink
      const link = data.localLink?.startsWith("http") ? data.localLink : null;

      // Agenda notificações WhatsApp (colaborador + cliente)
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
      }).catch(() => null);

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
        `.catch(() => null);
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  return { id };
}

export async function atualizarCompromissoAction(
  id: string,
  data: CompromissoData
): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");

  await atualizarCompromisso(id, data);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

export async function deletarCompromissoAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");

  await deletarCompromisso(id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}
