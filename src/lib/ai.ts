import OpenAI from "openai";

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 180,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente jurídico. Resuma o e-mail em 2 a 3 frases em português, destacando o que é mais importante para o advogado saber. Seja objetivo e direto.",
        },
        {
          role: "user",
          content: `Assunto: ${assunto ?? "(sem assunto)"}\n\n${texto.slice(0, 3000)}`,
        },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("[ai] resumirEmail:", err);
    return null;
  }
}
