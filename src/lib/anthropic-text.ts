import "server-only";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Extrai o texto de uma resposta da Claude API pegando o PRIMEIRO bloco de
 * tipo "text" em `res.content` — nunca assume que é `content[0]`. Modelos
 * mais novos podem anteceder o texto com outros tipos de bloco (ex:
 * thinking/reasoning), e o padrão antigo `content[0]?.type === "text" ?
 * content[0].text : fallback` caía silenciosamente no fallback nesse caso,
 * fazendo a análise inteira vir vazia/"{}" mesmo com a IA tendo gerado a
 * resposta certa (bug real: Diagnóstico Estratégico voltando "{}" em toda
 * probabilidade/pontos fortes/estratégia).
 */
export function extractText(res: Anthropic.Message): string {
  const bloco = res.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  return bloco?.text ?? "";
}
