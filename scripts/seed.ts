import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

interface SeedRow {
  type: string;
  name: string;
  doc: string;
  trade_name?: string;
  email: string;
  phone: string;
  cep: string;
  street: string;
  addr_number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  status: string;
  created_at: string;
}

const SEEDS: SeedRow[] = [
  {
    type: "PF",
    name: "Maria Fernanda Costa",
    doc: "123.456.234-90",
    email: "maria.costa@email.com",
    phone: "(11) 9 8765-4321",
    cep: "01310-100",
    street: "Av. Paulista",
    addr_number: "1000",
    complement: "Apto 52",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    status: "ativo",
    created_at: "2025-01-15",
  },
  {
    type: "PF",
    name: "João Roberto Silva",
    doc: "234.567.123-11",
    email: "joao.silva@email.com",
    phone: "(11) 9 7654-3210",
    cep: "13010-050",
    street: "Rua Barão de Jaguara",
    addr_number: "412",
    complement: null,
    neighborhood: "Centro",
    city: "Campinas",
    state: "SP",
    status: "ativo",
    created_at: "2024-03-20",
  },
  {
    type: "PJ",
    name: "Construtora Horizonte Ltda",
    doc: "12.345.678/0001-90",
    trade_name: "Horizonte Construções",
    email: "juridico@horizonte.com.br",
    phone: "(11) 3456-7890",
    cep: "04538-133",
    street: "Av. Brigadeiro Faria Lima",
    addr_number: "3477",
    complement: "Sala 201",
    neighborhood: "Itaim Bibi",
    city: "São Paulo",
    state: "SP",
    status: "ativo",
    created_at: "2023-06-10",
  },
  {
    type: "PF",
    name: "Ana Claudia Pereira",
    doc: "345.678.456-22",
    email: "ana.pereira@email.com",
    phone: "(19) 9 9876-5432",
    cep: "14010-050",
    street: "Rua Álvares Cabral",
    addr_number: "88",
    complement: null,
    neighborhood: "Centro",
    city: "Ribeirão Preto",
    state: "SP",
    status: "ativo",
    created_at: "2025-04-05",
  },
  {
    type: "PF",
    name: "Carlos Eduardo Mendes",
    doc: "456.789.789-33",
    email: "carlos.mendes@email.com",
    phone: "(21) 9 8888-7777",
    cep: "20040-020",
    street: "Av. Rio Branco",
    addr_number: "156",
    complement: null,
    neighborhood: "Centro",
    city: "Rio de Janeiro",
    state: "RJ",
    status: "inativo",
    created_at: "2023-11-08",
  },
  {
    type: "PJ",
    name: "Tech Solutions S/A",
    doc: "98.765.432/0001-10",
    trade_name: "Tech Solutions",
    email: "legal@techsolutions.com.br",
    phone: "(11) 3333-4444",
    cep: "04543-907",
    street: "Av. das Nações Unidas",
    addr_number: "12551",
    complement: "10º andar",
    neighborhood: "Brooklin",
    city: "São Paulo",
    state: "SP",
    status: "ativo",
    created_at: "2024-02-14",
  },
  {
    type: "PF",
    name: "Beatriz Oliveira Santos",
    doc: "567.890.321-44",
    email: "beatriz.santos@email.com",
    phone: "(31) 9 7777-6666",
    cep: "30112-020",
    street: "Av. Afonso Pena",
    addr_number: "600",
    complement: "Apto 301",
    neighborhood: "Centro",
    city: "Belo Horizonte",
    state: "MG",
    status: "ativo",
    created_at: "2025-05-02",
  },
  {
    type: "PF",
    name: "Rogério Alves Fernandes",
    doc: "678.901.654-55",
    email: "rogerio.fernandes@email.com",
    phone: "(41) 9 6666-5555",
    cep: "80020-030",
    street: "Rua XV de Novembro",
    addr_number: "321",
    complement: null,
    neighborhood: "Centro",
    city: "Curitiba",
    state: "PR",
    status: "ativo",
    created_at: "2024-09-18",
  },
  {
    type: "PJ",
    name: "Imobiliária Central Ltda",
    doc: "55.444.333/0001-60",
    trade_name: "Central Imóveis",
    email: "adm@imobiliariacentral.com.br",
    phone: "(11) 2222-3333",
    cep: "01014-001",
    street: "Rua Boa Vista",
    addr_number: "254",
    complement: "Sala 5",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    status: "ativo",
    created_at: "2023-01-22",
  },
  {
    type: "PF",
    name: "Patrícia Lima Carvalho",
    doc: "789.012.987-66",
    email: "patricia.carvalho@email.com",
    phone: "(85) 9 5555-4444",
    cep: "60055-000",
    street: "Av. Beira Mar",
    addr_number: "1019",
    complement: null,
    neighborhood: "Meireles",
    city: "Fortaleza",
    state: "CE",
    status: "inativo",
    created_at: "2024-07-30",
  },
  {
    type: "PF",
    name: "Lucas Henrique Barros",
    doc: "890.123.147-77",
    email: "lucas.barros@email.com",
    phone: "(48) 9 4444-3333",
    cep: "88010-971",
    street: "Rua Felipe Schmidt",
    addr_number: "515",
    complement: null,
    neighborhood: "Centro",
    city: "Florianópolis",
    state: "SC",
    status: "ativo",
    created_at: "2024-10-11",
  },
  {
    type: "PJ",
    name: "Grupo Empresarial Vanzolini",
    doc: "11.222.333/0001-40",
    trade_name: "Vanzolini Group",
    email: "contato@vanzolini.com.br",
    phone: "(11) 4444-5555",
    cep: "01310-000",
    street: "Av. Paulista",
    addr_number: "37",
    complement: "15º andar",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    status: "ativo",
    created_at: "2022-03-05",
  },
];

async function seed() {
  // Clear existing seed data by name to allow re-running safely
  const names = SEEDS.map((s) => s.name);
  await sql`DELETE FROM clients WHERE name = ANY(${names}::text[])`;

  for (const s of SEEDS) {
    await sql`
      INSERT INTO clients
        (type, name, doc, trade_name, email, phone,
         cep, street, addr_number, complement, neighborhood,
         city, state, status, created_at)
      VALUES
        (${s.type}, ${s.name}, ${s.doc}, ${s.trade_name ?? null},
         ${s.email}, ${s.phone}, ${s.cep}, ${s.street},
         ${s.addr_number}, ${s.complement ?? null}, ${s.neighborhood},
         ${s.city}, ${s.state}, ${s.status}, ${s.created_at}::date)
    `;
  }
  console.log(`✓ Seeded ${SEEDS.length} clients`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
