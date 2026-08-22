import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Documentos de um envelope passam a vir de Modelos (renderizados em HTML
  // com as variáveis do cliente já substituídas) em vez de upload de arquivo
  // solto — é o formato que a API do TramitaSign realmente aceita
  // (content_html), e permite reaproveitar os Modelos que o escritório já
  // usa em Documentos Automatizados. html_content guarda um snapshot do que
  // foi de fato assinado, mesmo que o modelo seja editado depois.
  await sql`
    ALTER TABLE envelope_documentos
      ADD COLUMN IF NOT EXISTS modelo_id UUID REFERENCES modelos_documento(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS html_content TEXT
  `;

  // Cliente do envelope — usado pra preencher as variáveis {{nome}}, {{cpf}}
  // etc. dos modelos selecionados.
  await sql`
    ALTER TABLE envelopes
      ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL
  `;

  console.log(
    "✓ colunas de modelo/HTML garantidas em envelope_documentos e envelopes"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
