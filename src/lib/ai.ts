import Anthropic from "@anthropic-ai/sdk";

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function resumirEmail(
  assunto: string | null,
  corpo: string | null
): Promise<string | null> {
  const texto = (corpo ?? "").trim();
  if (texto.length < 30) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 180,
      system:
        "Você é um assistente jurídico. Resuma o e-mail em 2 a 3 frases em português, destacando o que é mais importante para o advogado saber. Seja objetivo e direto.",
      messages: [
        {
          role: "user",
          content: `Assunto: ${assunto ?? "(sem assunto)"}\n\n${texto.slice(0, 3000)}`,
        },
      ],
    });
    const block = res.content[0];
    return block?.type === "text" ? block.text.trim() : null;
  } catch (err) {
    console.error("[ai] resumirEmail:", err);
    return null;
  }
}
