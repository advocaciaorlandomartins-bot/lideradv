import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type         VARCHAR(2)   NOT NULL CHECK (type IN ('PF', 'PJ')),
      name         VARCHAR(255) NOT NULL,
      doc          VARCHAR(20)  NOT NULL,
      trade_name   VARCHAR(255),
      birth_date   DATE,
      email        VARCHAR(255) NOT NULL,
      phone        VARCHAR(30)  NOT NULL,
      cep          VARCHAR(10)  NOT NULL,
      street       VARCHAR(255) NOT NULL,
      addr_number  VARCHAR(30)  NOT NULL,
      complement   VARCHAR(255),
      neighborhood VARCHAR(100) NOT NULL,
      city         VARCHAR(100) NOT NULL,
      state        VARCHAR(2)   NOT NULL,
      notes        TEXT,
      status       VARCHAR(10)  NOT NULL DEFAULT 'ativo',
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ Table clients created (or already exists)");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
