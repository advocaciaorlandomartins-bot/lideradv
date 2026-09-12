import "server-only";
import sql from "./db";
import {
  agendarNotificacoesCompromisso,
  cancelarLembretesCompromisso,
} from "./lembretes";
import { enviarMensagemDireta } from "./prevbot-outbound";

/**
 * Perícia (Controles → Perícias) e compromisso (Agenda) descrevem o mesmo
 * evento real, mas vivem em tabelas separadas sem sincronia automática —
 * editar a data da perícia não refletia na Agenda, a entrada antiga ficava
 * parada com a data velha, e o cliente nunca era avisado da remarcação.
 * Chame isto depois de qualquer UPDATE em `pericias` que mude data/hora/
 * local — só age quando a perícia já está ligada a um compromisso
 * (`pericias.compromisso_id`); perícias criadas antes desse vínculo existir
 * (ou sem compromisso correspondente na Agenda) precisam ser ligadas
 * manualmente uma vez — ver o caso do Anthony corrigido em 11/09/2026.
 *
 * IMPORTANTE: o telefone usado pra avisar é sempre o CADASTRADO no cliente
 * (respeitando o redirecionamento pra responsável legal quando
 * menor_incapaz) — nunca um número lido de um documento anexado. Um caso
 * real mostrou a IA extraindo de um comprovante um "celular do cliente"
 * que na verdade era o celular do próprio advogado (usado pra agendar a
 * perícia em nome do cliente no Meu INSS), não da família.
 */
export async function sincronizarCompromissoDaPericia(
  periciaId: string
): Promise<{ sincronizado: boolean; avisoEnviado: boolean }> {
  const [pericia] = await sql`
    SELECT
      p.compromisso_id::text, p.tipo, p.client_id::text, p.processo_id::text,
      p.data_pericia::text, p.hora_pericia::text, p.local_pericia, p.observacoes
    FROM pericias p
    WHERE p.id = ${periciaId}::uuid
  `;
  if (!pericia?.compromisso_id)
    return { sincronizado: false, avisoEnviado: false };

  const [cliente] = await sql`
    SELECT id::text, name, phone, menor_incapaz, responsavel_nome, responsavel_telefone
    FROM clients WHERE id = ${pericia.client_id}::uuid
  `;
  if (!cliente) return { sincronizado: false, avisoEnviado: false };

  const horaFmt = pericia.hora_pericia
    ? String(pericia.hora_pericia).slice(0, 5)
    : null;

  await sql`
    UPDATE compromissos SET
      data_inicio    = ${pericia.data_pericia}::date,
      hora_inicio    = ${horaFmt},
      local_link     = ${pericia.local_pericia},
      descricao      = ${pericia.observacoes},
      status         = 'pendente',
      confirmado_em  = NULL,
      atualizado_em  = NOW()
    WHERE id = ${pericia.compromisso_id}::uuid
  `;

  // Lembretes já agendados carregam a data/hora antigas no texto — sem
  // baixá-los e recriar, o cliente receberia aviso da data errada.
  await cancelarLembretesCompromisso(
    pericia.compromisso_id,
    "pericia_remarcada"
  ).catch(() => null);

  const dataEvento = new Date(pericia.data_pericia + "T12:00:00");
  const clienteResponsavel =
    cliente.menor_incapaz &&
    cliente.responsavel_nome &&
    cliente.responsavel_telefone
      ? {
          nome: String(cliente.responsavel_nome),
          telefone: String(cliente.responsavel_telefone),
        }
      : null;
  const clienteContato =
    !clienteResponsavel && cliente.phone
      ? {
          id: String(cliente.id),
          nome: String(cliente.name),
          telefone: String(cliente.phone),
        }
      : null;

  await agendarNotificacoesCompromisso({
    compromissoId: pericia.compromisso_id,
    titulo: String(pericia.tipo),
    tipo: "consulta",
    dataEvento,
    hora: horaFmt,
    local: pericia.local_pericia,
    link: null,
    colaborador: null,
    cliente: clienteContato,
    clienteResponsavel,
  }).catch(() => null);

  // Aviso imediato da remarcação — os lembretes acima só disparam mais perto
  // da data (ex.: "1 dia antes"); quem remarca quer que o cliente saiba
  // agora, não só no lembrete padrão.
  const destino = clienteResponsavel ?? clienteContato;
  let avisoEnviado = false;
  if (destino) {
    const dataFmt = dataEvento.toLocaleDateString("pt-BR");
    const horaStr = horaFmt ? ` às ${horaFmt}` : "";
    const localStr = pericia.local_pericia
      ? `\n📍 ${pericia.local_pericia}`
      : "";
    const mensagem =
      `🔄 *Avaliação remarcada*\n\n` +
      `Sua avaliação (${String(pericia.tipo).replace(/_/g, " ")}) foi remarcada para *${dataFmt}${horaStr}*.` +
      `${localStr}\n\nQualquer dúvida, fale com o escritório.`;
    const res = await enviarMensagemDireta({
      telefone: destino.telefone,
      mensagem,
    }).catch(() => ({ ok: false }));
    avisoEnviado = res.ok;
  }

  return { sincronizado: true, avisoEnviado };
}
