"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { getColaboradorFull } from "./colaboradores-db";
import { getEscritorioConfig } from "./escritorio-db";
import sql from "./db";
import {
  buildModeloVarsColaborador,
  colaboradorDadosCompletosParaContrato,
} from "./modelo-vars";
import { blocksToHtml, substituteVariablesInBlocks } from "./modelo-blocks";
import { criarEnvelope } from "./assinaturas-db";
import { enviarEnvelopeParaTramitaSign } from "./assinaturas-actions";

const TITULO_MODELO = "Contrato de Parceria entre Advogados";

/**
 * Envia o Contrato de Parceria pra assinatura digital de um colaborador —
 * equivalente ao fluxo de Procuração/Contrato de Honorários do cliente
 * (mesmo TramitaSign), só que o "outro lado" é um colaborador (cargo
 * Advogado(a) Parceiro(a)), não um cliente. Usa sempre o modelo com título
 * fixo acima (criado por scripts/seed-modelo-contrato-parceria.ts) — não
 * dá pra escolher outro modelo aqui de propósito, já que o texto depende
 * das tags {{colaborador_*}}/{{comissao_*}} que só esse modelo usa.
 */
export async function enviarContratoParceriaAction(
  colaboradorId: string
): Promise<{ error?: string; envelopeId?: string }> {
  const session = await getSession();
  if (
    !session ||
    !hasPermission(session, "colaboradores", "editar") ||
    !hasPermission(session, "assinaturas", "criar")
  )
    return { error: "Sem permissão." };

  const colaborador = await getColaboradorFull(colaboradorId);
  if (!colaborador) return { error: "Colaborador não encontrado." };

  const faltando = colaboradorDadosCompletosParaContrato(colaborador);
  if (faltando.length > 0) {
    return {
      error: `Complete o cadastro do colaborador antes de enviar: ${faltando.join(", ")}.`,
    };
  }

  const [modelo] = await sql`
    SELECT id::text, titulo, conteudo, conteudo_blocks, usar_timbrado,
           ocultar_identificacao_escritorio
    FROM modelos_documento
    WHERE titulo = ${TITULO_MODELO} AND ativo = true
  `;
  if (!modelo) {
    return {
      error:
        'Modelo "Contrato de Parceria entre Advogados" não encontrado — rode scripts/seed-modelo-contrato-parceria.ts.',
    };
  }

  const escritorioConfig = await getEscritorioConfig();
  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  const vars = buildModeloVarsColaborador(colaborador, escritorioConfig, date);

  const blocks = modelo.conteudo_blocks
    ? substituteVariablesInBlocks(modelo.conteudo_blocks, vars)
    : null;
  const html = blocks
    ? blocksToHtml(blocks)
    : (modelo.conteudo as string).replace(
        /\{\{\w+\}\}/g,
        (m: string) => vars[m] ?? m
      );

  if (!colaborador.email)
    return { error: "Colaborador sem e-mail cadastrado." };

  const { id: envelopeId, assinantes } = await criarEnvelope({
    nome: `Contrato de Parceria — ${colaborador.nome}`,
    prazo: null,
    status: "aguardando",
    notifAssinantes: true,
    notifCriador: true,
    notifEscritorio: false,
    criadoPor: session.login,
    colaboradorId,
    assinantes: [
      {
        tipo: "colaborador",
        nome: colaborador.nome,
        email: colaborador.email,
        papel: "assinante",
        valEmail: true,
        valSelfie: false,
        valDocumento: false,
        valAssinaturaDesenhada: false,
        ordem: 1,
      },
    ],
    documentos: [
      {
        modeloId: modelo.id,
        nome: modelo.titulo,
        htmlContent: html,
        ordem: 1,
      },
    ],
  });

  if (assinantes.length > 0) {
    after(() =>
      enviarEnvelopeParaTramitaSign(envelopeId).catch((e) =>
        console.error("[contrato-parceria] envio ao TramitaSign falhou:", e)
      )
    );
  }

  revalidatePath("/dashboard/assinaturas");
  revalidatePath(`/dashboard/colaboradores/${colaboradorId}`);
  return { envelopeId };
}
