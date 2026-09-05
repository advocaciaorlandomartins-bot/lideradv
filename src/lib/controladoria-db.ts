import sql from "./db";

export interface ItemAberto {
  id: string;
  origem: "controle" | "tarefa" | "crm";
  categoria: string;
  categoriaLabel: string;
  titulo: string;
  clienteNome: string | null;
  criadoEm: string;
  prazoInterno: string | null;
  prazoFinal: string | null;
  diasAberto: number;
  /** tranquilo = sem prazo próximo; proximo = já passou do prazo interno (ideal) ou falta pouco pro final; vencido = passou do prazo final. */
  statusPrazo: "tranquilo" | "proximo" | "vencido";
  /** Preenchido só quando origem="crm" — pra montar o link de volta pro lead. */
  leadId: string | null;
}

export interface CargaColaborador {
  colaboradorId: string;
  nome: string;
  cargo: string;
  totalAbertas: number;
  totalVencidas: number;
  proximoPrazo: string | null;
  /** Detalhamento do total de abertas por categoria — só entram categorias com total > 0. */
  porCategoria: { categoria: string; label: string; total: number }[];
  /** Itens abertos, do mais antigo pro mais novo — pra saber exatamente o que cobrar e desde quando. */
  itens: ItemAberto[];
  /** Item aberto há mais tempo (o primeiro que entrou e ainda não saiu). */
  itemMaisAntigo: ItemAberto | null;
  /** Item aberto mais recentemente. */
  itemMaisRecente: ItemAberto | null;
}

const CATEGORIA_LABEL: Record<string, string> = {
  audiencias: "Audiência",
  prazos: "Prazo",
  pericias: "Perícia",
  dcb: "DCB",
  beneficios: "Benefício",
  implantados: "Benefício",
  "implantados-data": "Benefício",
  alvaras: "Benefício",
  servicos: "Serviço",
  crm: "Atendimento",
};

const CATEGORIA_LABEL_PLURAL: Record<string, string> = {
  audiencias: "Audiências",
  prazos: "Prazos",
  pericias: "Perícias",
  beneficios: "Benefícios",
  servicos: "Serviços",
  crm: "Atendimentos",
};

/**
 * "itens" traz título e nome do cliente de cada item aberto — quem não tem
 * processos_ver_todos só pode ver esse detalhe do próprio trabalho, não do
 * de todo mundo (mesma regra de escopo usada em processos/Cérebro
 * Jurídico/Íris). Os agregados (total aberto, categorias, vencidas)
 * continuam visíveis pra todo mundo — só a lista item-a-item é restrita.
 */
export function filtrarCargaPorPermissao(
  carga: CargaColaborador[],
  podeVerDetalhesDeTodos: boolean,
  meuColaboradorId: string | null
): CargaColaborador[] {
  if (podeVerDetalhesDeTodos) return carga;
  return carga.map((c) =>
    c.colaboradorId === meuColaboradorId
      ? c
      : { ...c, itens: [], itemMaisAntigo: null, itemMaisRecente: null }
  );
}

const HOJE_MS = () => Date.now();
const DIA_MS = 1000 * 60 * 60 * 24;

function diasEntre(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  return Math.max(0, Math.floor((HOJE_MS() - d.getTime()) / DIA_MS));
}

/** Item sem nenhum prazo cadastrado que já está aberto há mais tempo que isso vira "proximo" — sem prazo não é sinônimo de sem risco, é só um item que pode ficar esquecido pra sempre se ninguém olhar. */
const DIAS_ATENCAO_SEM_PRAZO = 15;

function classificarStatusPrazo(
  prazoInterno: string | null,
  prazoFinal: string | null,
  diasAberto: number
): "tranquilo" | "proximo" | "vencido" {
  const hoje = new Date().toISOString().slice(0, 10);
  if (prazoFinal && prazoFinal < hoje) return "vencido";
  if (prazoFinal) {
    const diasParaFinal = diasEntre(prazoFinal) * -1; // negativo = faltam dias
    if (diasParaFinal >= -5) return "proximo";
  }
  if (prazoInterno && prazoInterno < hoje) return "proximo";
  if (!prazoInterno && !prazoFinal && diasAberto >= DIAS_ATENCAO_SEM_PRAZO)
    return "proximo";
  return "tranquilo";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(r: any, origem: "controle" | "tarefa" | "crm"): ItemAberto {
  const categoria =
    origem === "tarefa"
      ? "servicos"
      : origem === "crm"
        ? "crm"
        : String(r.tipo);
  const criadoEm = String(r.criado_em).slice(0, 10);
  const prazoInterno = r.prazo_interno
    ? String(r.prazo_interno).slice(0, 10)
    : null;
  const prazoFinal = r.prazo_final ? String(r.prazo_final).slice(0, 10) : null;
  return {
    id: String(r.id),
    origem,
    categoria,
    categoriaLabel: CATEGORIA_LABEL[categoria] ?? "Outro",
    titulo: String(r.titulo ?? r.descricao ?? "—"),
    clienteNome: r.cliente_nome ? String(r.cliente_nome) : null,
    criadoEm,
    prazoInterno,
    prazoFinal,
    diasAberto: diasEntre(criadoEm),
    statusPrazo: classificarStatusPrazo(
      prazoInterno,
      prazoFinal,
      diasEntre(criadoEm)
    ),
    leadId: origem === "crm" && r.lead_id ? String(r.lead_id) : null,
  };
}

/**
 * Carga de trabalho atual de cada colaborador ativo — não só a contagem,
 * mas a lista real do que está aberto (título, cliente, desde quando, prazo
 * interno/final), pra dar pra cobrar um responsável específico por um item
 * específico em vez de só ver um número solto. "beneficios" agrupa dcb/
 * beneficios/implantados/implantados-data/alvaras — categorias finas demais
 * pra listar uma a uma sem poluir o painel. "servicos" são as
 * tarefas_processo (ex: "verificar documentação", "dar entrada").
 *
 * colaboradorId: quando informado, restringe a lista (e as três consultas de
 * itens abertos) a esse colaborador só — usado para quem não tem
 * "processos_ver_todos" (mesma regra de escopo do resto do sistema). Sem
 * isso, nome, cargo e os agregados (totalAbertas, totalVencidas,
 * porCategoria) de todo mundo chegavam ao navegador de qualquer usuário com
 * acesso à Controladoria, mesmo que só o detalhe item a item já fosse
 * restrito por filtrarCargaPorPermissao.
 */
export async function getCargaColaboradores(
  colaboradorId?: string | null
): Promise<CargaColaborador[]> {
  const [controlesRows, tarefasRows, crmRows] = await Promise.all([
    colaboradorId
      ? sql`
          SELECT
            c.id::text, u.colaborador_id::text AS colaborador_id, c.tipo,
            c.descricao AS titulo, cl.name AS cliente_nome,
            c.created_at::text AS criado_em,
            c.prazo_interno::text AS prazo_interno,
            c.data_evento::text AS prazo_final
          FROM controles c
          JOIN usuarios u ON u.id = c.responsavel_id
          LEFT JOIN clients cl ON cl.id = c.cliente_id
          WHERE c.status IS NULL AND u.colaborador_id = ${colaboradorId}::uuid
        `
      : sql`
          SELECT
            c.id::text, u.colaborador_id::text AS colaborador_id, c.tipo,
            c.descricao AS titulo, cl.name AS cliente_nome,
            c.created_at::text AS criado_em,
            c.prazo_interno::text AS prazo_interno,
            c.data_evento::text AS prazo_final
          FROM controles c
          JOIN usuarios u ON u.id = c.responsavel_id
          LEFT JOIN clients cl ON cl.id = c.cliente_id
          WHERE c.status IS NULL
        `,
    colaboradorId
      ? sql`
          SELECT
            t.id::text, col.id::text AS colaborador_id, t.titulo,
            cl.name AS cliente_nome,
            t.created_at::text AS criado_em,
            NULL::text AS prazo_interno,
            t.prazo::text AS prazo_final
          FROM tarefas_processo t
          JOIN colaboradores col ON col.nome = t.responsavel AND col.status = 'ativo'
          LEFT JOIN clients cl ON cl.id = t.client_id
          WHERE t.status IN ('Pendente', 'Em andamento') AND col.id = ${colaboradorId}::uuid
        `
      : sql`
          SELECT
            t.id::text, col.id::text AS colaborador_id, t.titulo,
            cl.name AS cliente_nome,
            t.created_at::text AS criado_em,
            NULL::text AS prazo_interno,
            t.prazo::text AS prazo_final
          FROM tarefas_processo t
          JOIN colaboradores col ON col.nome = t.responsavel AND col.status = 'ativo'
          LEFT JOIN clients cl ON cl.id = t.client_id
          WHERE t.status IN ('Pendente', 'Em andamento')
        `,
    colaboradorId
      ? sql`
          SELECT
            t.id::text, t.responsavel_id::text AS colaborador_id, t.titulo,
            l.nome AS cliente_nome, l.id::text AS lead_id,
            t.created_at::text AS criado_em,
            NULL::text AS prazo_interno,
            t.data_vencimento::text AS prazo_final
          FROM crm_tarefas t
          JOIN crm_leads l ON l.id = t.lead_id
          WHERE t.concluida = FALSE AND t.responsavel_id = ${colaboradorId}::uuid
        `
      : sql`
          SELECT
            t.id::text, t.responsavel_id::text AS colaborador_id, t.titulo,
            l.nome AS cliente_nome, l.id::text AS lead_id,
            t.created_at::text AS criado_em,
            NULL::text AS prazo_interno,
            t.data_vencimento::text AS prazo_final
          FROM crm_tarefas t
          JOIN crm_leads l ON l.id = t.lead_id
          WHERE t.concluida = FALSE AND t.responsavel_id IS NOT NULL
        `,
  ]);

  const colaboradores = colaboradorId
    ? await sql`
        SELECT id::text, nome, cargo FROM colaboradores
        WHERE status = 'ativo' AND id = ${colaboradorId}::uuid
        ORDER BY nome
      `
    : await sql`
        SELECT id::text, nome, cargo FROM colaboradores WHERE status = 'ativo' ORDER BY nome
      `;

  const itensPorColaborador = new Map<string, ItemAberto[]>();
  for (const r of controlesRows) {
    const item = mapItem(r, "controle");
    const arr = itensPorColaborador.get(String(r.colaborador_id)) ?? [];
    arr.push(item);
    itensPorColaborador.set(String(r.colaborador_id), arr);
  }
  for (const r of tarefasRows) {
    const item = mapItem(r, "tarefa");
    const arr = itensPorColaborador.get(String(r.colaborador_id)) ?? [];
    arr.push(item);
    itensPorColaborador.set(String(r.colaborador_id), arr);
  }
  for (const r of crmRows) {
    const item = mapItem(r, "crm");
    const arr = itensPorColaborador.get(String(r.colaborador_id)) ?? [];
    arr.push(item);
    itensPorColaborador.set(String(r.colaborador_id), arr);
  }

  return colaboradores
    .map((col) => {
      const itens = (itensPorColaborador.get(String(col.id)) ?? []).sort(
        (a, b) =>
          a.criadoEm < b.criadoEm ? -1 : a.criadoEm > b.criadoEm ? 1 : 0
      );
      const porCategoriaMap = new Map<string, number>();
      for (const item of itens) {
        porCategoriaMap.set(
          item.categoria === "servicos" ? "servicos" : item.categoria,
          (porCategoriaMap.get(item.categoria) ?? 0) + 1
        );
      }
      // Agrupa os tipos "benefício" (dcb/beneficios/implantados/implantados-data/alvaras) numa só pill.
      let beneficios = 0;
      for (const tipo of [
        "dcb",
        "beneficios",
        "implantados",
        "implantados-data",
        "alvaras",
      ]) {
        beneficios += porCategoriaMap.get(tipo) ?? 0;
        porCategoriaMap.delete(tipo);
      }
      if (beneficios > 0) porCategoriaMap.set("beneficios", beneficios);

      const proximosPrazos = itens
        .map((i) => i.prazoInterno ?? i.prazoFinal)
        .filter(
          (d): d is string => !!d && d >= new Date().toISOString().slice(0, 10)
        )
        .sort();

      return {
        colaboradorId: String(col.id),
        nome: String(col.nome),
        cargo: String(col.cargo),
        totalAbertas: itens.length,
        totalVencidas: itens.filter((i) => i.statusPrazo === "vencido").length,
        proximoPrazo: proximosPrazos[0] ?? null,
        porCategoria: Array.from(porCategoriaMap.entries()).map(
          ([categoria, total]) => ({
            categoria,
            label: CATEGORIA_LABEL_PLURAL[categoria] ?? categoria,
            total,
          })
        ),
        itens,
        itemMaisAntigo: itens[0] ?? null,
        itemMaisRecente: itens[itens.length - 1] ?? null,
      };
    })
    .sort((a, b) => b.totalAbertas - a.totalAbertas);
}

export interface CapacidadeSemana {
  semana: string; // YYYY-MM-DD (segunda-feira da semana)
  entraram: number;
  saidas: number;
}

/**
 * Vazão de trabalho por semana: quanto entrou (tarefas/controles criados)
 * vs. quanto saiu (concluído, via pontuacao_eventos — só existe a partir de
 * quando esse ledger foi criado, então semanas anteriores aparecem com
 * "saidas" zerado por falta de dado histórico, não por bug).
 */
export async function getCapacidadeProdutiva(
  semanas = 8
): Promise<CapacidadeSemana[]> {
  const [entradas, saidas] = await Promise.all([
    sql`
      SELECT date_trunc('week', criado_em)::date::text AS semana, COUNT(*)::int AS n
      FROM (
        SELECT created_at AS criado_em FROM controles
        WHERE created_at >= NOW() - (${semanas} || ' weeks')::interval
        UNION ALL
        SELECT created_at AS criado_em FROM tarefas_processo
        WHERE created_at >= NOW() - (${semanas} || ' weeks')::interval
      ) x
      GROUP BY 1
      ORDER BY 1
    `,
    sql`
      SELECT date_trunc('week', criado_em)::date::text AS semana, COUNT(*)::int AS n
      FROM pontuacao_eventos
      WHERE criado_em >= NOW() - (${semanas} || ' weeks')::interval
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  // date_trunc(...)::date volta como objeto Date do driver, não string — usar
  // String(date).slice(0,10) pega "Mon Aug 10" (toString() do JS Date), não
  // o ISO "YYYY-MM-DD". Isso ordenava as semanas alfabeticamente por nome do
  // dia/mês em vez de cronologicamente. ::text já converte no Postgres, que
  // devolve o formato ISO certo independente do driver.
  const mapEntradas = new Map<string, number>(
    entradas.map((r) => [String(r.semana).slice(0, 10), Number(r.n)])
  );
  const mapSaidas = new Map<string, number>(
    saidas.map((r) => [String(r.semana).slice(0, 10), Number(r.n)])
  );

  const todasSemanas = Array.from(
    new Set([...mapEntradas.keys(), ...mapSaidas.keys()])
  ).sort();

  return todasSemanas.map((semana) => ({
    semana,
    entraram: mapEntradas.get(semana) ?? 0,
    saidas: mapSaidas.get(semana) ?? 0,
  }));
}

export interface CapacidadeSemanaComFila extends CapacidadeSemana {
  filaAcumulada: number;
}

export interface CapacidadeResumo {
  semanas: CapacidadeSemanaComFila[];
  filaAtual: number;
  entradaMediaRecente: number;
  saidaMediaRecente: number;
  saldoMedioRecente: number;
  entradaVariacaoPct: number | null;
  saidaVariacaoPct: number | null;
  narrativa: string;
}

function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

/**
 * Mesmo dado de getCapacidadeProdutiva, mas com fila acumulada (saldo
 * corrido de entraram-saidas semana a semana) e uma narrativa automática
 * comparando as últimas semanas com as anteriores — mesma ressalva de
 * dados: semanas antes do ledger de conclusão existir mostram "saidas"
 * zerado, o que infla a fila acumulada ali por falta de histórico, não por
 * atraso real da equipe.
 */
export async function getCapacidadeResumo(
  semanas = 8
): Promise<CapacidadeResumo> {
  const semanasBase = await getCapacidadeProdutiva(semanas);

  let acumulado = 0;
  const comFila: CapacidadeSemanaComFila[] = semanasBase.map((s) => {
    acumulado += s.entraram - s.saidas;
    return { ...s, filaAcumulada: Math.max(0, acumulado) };
  });

  const n = comFila.length;
  const recentes = comFila.slice(Math.max(0, n - 3));
  const anteriores = comFila.slice(Math.max(0, n - 6), Math.max(0, n - 3));

  const media = (
    arr: CapacidadeSemanaComFila[],
    campo: "entraram" | "saidas"
  ) =>
    arr.length === 0 ? 0 : arr.reduce((s, c) => s + c[campo], 0) / arr.length;

  const entradaMediaRecente = media(recentes, "entraram");
  const saidaMediaRecente = media(recentes, "saidas");
  const entradaMediaAnterior = media(anteriores, "entraram");
  const saidaMediaAnterior = media(anteriores, "saidas");
  const saldoMedioRecente = entradaMediaRecente - saidaMediaRecente;
  const filaAtual =
    comFila.length > 0 ? comFila[comFila.length - 1].filaAcumulada : 0;

  const entradaVariacaoPct = variacaoPct(
    entradaMediaRecente,
    entradaMediaAnterior
  );
  const saidaVariacaoPct = variacaoPct(saidaMediaRecente, saidaMediaAnterior);

  let narrativa: string;
  if (n === 0 || (entradaMediaRecente === 0 && saidaMediaRecente === 0)) {
    narrativa = "Ainda sem dados suficientes pra avaliar a tendência.";
  } else if (Math.abs(saldoMedioRecente) < 1) {
    narrativa = `A equipe está dando conta do volume. O que entra e o que sai andam no mesmo ritmo — entram ${entradaMediaRecente.toFixed(1)} e saem ${saidaMediaRecente.toFixed(1)} por semana.`;
  } else if (saldoMedioRecente > 0) {
    narrativa = `A fila está crescendo. Entram ${entradaMediaRecente.toFixed(1)} e saem ${saidaMediaRecente.toFixed(1)} por semana — saldo de +${saldoMedioRecente.toFixed(1)} acumulando por semana.`;
  } else {
    narrativa = `A equipe está reduzindo a fila. Entram ${entradaMediaRecente.toFixed(1)} e saem ${saidaMediaRecente.toFixed(1)} por semana — saldo de ${saldoMedioRecente.toFixed(1)} por semana.`;
  }

  return {
    semanas: comFila,
    filaAtual,
    entradaMediaRecente,
    saidaMediaRecente,
    saldoMedioRecente,
    entradaVariacaoPct,
    saidaVariacaoPct,
    narrativa,
  };
}
