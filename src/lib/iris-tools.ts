import Anthropic from "@anthropic-ai/sdk";
import sql from "./db";
import { enviarMensagemDireta } from "./prevbot-outbound";
import { getLancamentoKpis, getContasAReceber } from "./lancamentos-db";
import { hasPermission } from "./permissoes";
import { getColaboradorIdForUser } from "./usuarios-db";
import { podeAcessarCliente } from "./acesso";
import { getTipoConfig } from "./controles-types";
import type { SessionUser } from "./session";

// Rótulo amigável exibido na tela como "trace" de consultas (ex: "Consultou o
// financeiro") enquanto a Íris usa ferramentas antes de responder.
export const IRIS_TOOL_LABELS: Record<string, string> = {
  verificar_saude: "Verificou a saúde do sistema",
  obter_estatisticas: "Consultou as estatísticas gerais",
  sincronizar_publicacoes: "Sincronizou as publicações",
  reenviar_mensagens_falhadas: "Reenviou as mensagens pendentes",
  reenviar_lembretes: "Reenviou os lembretes",
  cancelar_lembretes_atrasados: "Cancelou os lembretes atrasados",
  listar_oabs: "Consultou as OABs monitoradas",
  adicionar_oab: "Adicionou uma OAB",
  remover_oab: "Removeu uma OAB",
  atualizar_escritorio: "Atualizou dados do escritório",
  testar_whatsapp: "Testou o envio de WhatsApp",
  ver_erros: "Verificou os erros do sistema",
  consultar_financeiro: "Consultou o financeiro",
  listar_processos_risco: "Consultou processos por risco",
  consultar_analise_cerebro: "Consultou o Cérebro Jurídico",
  listar_etiquetas: "Consultou as etiquetas cadastradas",
  adicionar_etiqueta: "Aplicou uma etiqueta",
  consultar_atualizacoes_legais: "Consultou mudanças legais recentes",
  listar_processos_parados: "Consultou processos parados",
  consultar_saude_financeira: "Consultou a saúde financeira",
  listar_clientes_sem_resposta: "Consultou clientes sem resposta no WhatsApp",
  remarcar_pericia: "Remarcou uma perícia/avaliação",
  agendar_pericia: "Agendou uma perícia/avaliação nova",
  criar_controle_pericia: "Criou um controle de perícia/prorrogação",
  cadastrar_cliente: "Cadastrou um novo cliente",
  complementar_cliente: "Completou dados do cadastro de um cliente",
  criar_controle: "Criou um controle (audiência/prazo/DCB/benefício/alvará)",
};

export const IRIS_TOOLS: Anthropic.Tool[] = [
  {
    name: "verificar_saude",
    description:
      "Verifica o status de todos os componentes do sistema: banco de dados, variáveis de ambiente, OABs monitoradas, mensagens WhatsApp pendentes, publicações não lidas.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "obter_estatisticas",
    description:
      "Retorna estatísticas do sistema: total de clientes, processos, publicações, leads e OABs ativas.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "sincronizar_publicacoes",
    description:
      "Busca novas publicações e intimações em todas as fontes (DJe, DJEN/TRF5, TramitaSign). Ação real — requer permissão de administrador.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "reenviar_mensagens_falhadas",
    description:
      "Reenvia eventos CRM (honorário pago, processo deferido etc.) que estão na fila de pendentes. Ação real — requer permissão de administrador.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "reenviar_lembretes",
    description:
      "Reenvia os lembretes WhatsApp pendentes de agenda, honorários e pagamentos que ainda não foram enviados. Ação real — requer permissão de administrador.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "cancelar_lembretes_atrasados",
    description:
      "Cancela (sem enviar) todos os lembretes que já passaram da data. Ação real — requer permissão de administrador.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "listar_oabs",
    description: "Lista todas as OABs monitoradas pelo sistema com status.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "adicionar_oab",
    description:
      "Adiciona uma nova OAB para monitoramento automático de publicações. Ação real — requer permissão de administrador.",
    input_schema: {
      type: "object",
      properties: {
        numero: {
          type: "string",
          description: "Número da OAB (somente dígitos, ex: 14381)",
        },
        estado: { type: "string", description: "Sigla do estado (ex: AL)" },
        nome_advogado: {
          type: "string",
          description: "Nome do advogado (opcional)",
        },
      },
      required: ["numero", "estado"],
    },
  },
  {
    name: "remover_oab",
    description:
      "Remove uma OAB do monitoramento de publicações. Ação real — requer permissão de administrador.",
    input_schema: {
      type: "object",
      properties: {
        numero: { type: "string", description: "Número da OAB" },
        estado: { type: "string", description: "Sigla do estado" },
      },
      required: ["numero", "estado"],
    },
  },
  {
    name: "atualizar_escritorio",
    description:
      "Atualiza dados do escritório. Campos permitidos: telefone, email, nome, cidade, estado, endereco, oab, cnpj, site, cep. Ação real — requer permissão de administrador.",
    input_schema: {
      type: "object",
      properties: {
        campo: { type: "string" },
        valor: { type: "string" },
      },
      required: ["campo", "valor"],
    },
  },
  {
    name: "testar_whatsapp",
    description:
      "Envia uma mensagem de teste pelo WhatsApp. Ação real — requer permissão de administrador.",
    input_schema: {
      type: "object",
      properties: {
        telefone: { type: "string" },
        mensagem: { type: "string" },
      },
      required: ["telefone", "mensagem"],
    },
  },
  {
    name: "ver_erros",
    description:
      "Mostra os erros e mensagens falhadas recentes do sistema para diagnóstico.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "consultar_financeiro",
    description:
      "Consulta dados financeiros do escritório: KPIs gerais e contas a receber por cliente. Use quando pedirem contas em aberto, histórico de pagamentos ou situação financeira geral.",
    input_schema: {
      type: "object",
      properties: {
        cliente_nome: {
          type: "string",
          description:
            "Nome do cliente para detalhar. Se omitido, retorna resumo geral.",
        },
      },
      required: [],
    },
  },
  {
    name: "listar_processos_risco",
    description:
      "Lista processos ativos (não arquivados/encerrados) analisados pelo Cérebro Jurídico, com risco (alto/médio/baixo) e probabilidade de êxito. Use quando o usuário perguntar sobre risco de processos, quais casos precisam de atenção, ou quer uma visão geral das análises do Cérebro Jurídico.",
    input_schema: {
      type: "object",
      properties: {
        risco: {
          type: "string",
          description:
            "Filtra por 'alto', 'medio' ou 'baixo'. Se omitido, traz todos ordenados do maior risco pro menor.",
        },
      },
      required: [],
    },
  },
  {
    name: "consultar_analise_cerebro",
    description:
      "Traz a análise mais recente do Cérebro Jurídico (risco, probabilidade de êxito, próxima ação, base legal) para um cliente ou processo específico, pelo nome do cliente ou número do processo.",
    input_schema: {
      type: "object",
      properties: {
        busca: {
          type: "string",
          description:
            "Nome do cliente (ou parte) ou número do processo (CNJ).",
        },
      },
      required: ["busca"],
    },
  },
  {
    name: "listar_processos_parados",
    description:
      "Lista processos ativos (não arquivados) que estão há muito tempo sem mudança de estágio (analise/produção/administrativo/judicial) — sinal de que ninguém está tocando o caso. Não existe SLA oficial no sistema; usa 30 dias como limiar de bom senso. Use quando o usuário perguntar 'quais processos estão parados', 'o que ninguém está tocando' ou pedir uma visão de gargalos.",
    input_schema: {
      type: "object",
      properties: {
        dias_minimo: {
          type: "string",
          description:
            "Quantidade mínima de dias parado pra entrar na lista. Se omitido, usa 30.",
        },
      },
      required: [],
    },
  },
  {
    name: "listar_clientes_sem_resposta",
    description:
      "Lista clientes com processo ativo que mandamos mensagem no WhatsApp (via PrevBot) e ainda não responderam, com há quantos dias. Consulta o PrevBot (sistema externo) em tempo real — pode demorar alguns segundos. Use quando o usuário perguntar sobre cliente que sumiu, não responde, ou pedir uma visão de acompanhamento de atendimento.",
    input_schema: {
      type: "object",
      properties: {
        dias_minimo: {
          type: "string",
          description:
            "Quantidade mínima de dias sem resposta pra entrar na lista. Se omitido, usa 3.",
        },
      },
      required: [],
    },
  },
  {
    name: "consultar_saude_financeira",
    description:
      "Traz KPIs financeiros do escritório inteiro: total a receber, recebido, a pagar, pago, folha pendente/paga, e quantidade + valor de lançamentos em atraso. Use pra perguntas sobre saúde financeira geral, inadimplência ou fluxo de caixa do escritório (não é o financeiro pessoal de um colaborador).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "consultar_atualizacoes_legais",
    description:
      "Consulta mudanças legais/normativas recentes (últimos 6 meses, impacto alto ou médio) que afetam benefícios previdenciários — instruções normativas do INSS, portarias, decretos, mudanças de cálculo/carência/prazo. Já vem classificado por impacto, com 'o que muda na prática' e 'ação recomendada' (análise automática do cron diário de atualizações legais). Use ANTES de responder sobre regras/critérios/carência de um benefício específico, pra garantir que a informação não ficou desatualizada por uma mudança recente que o modelo não conhece.",
    input_schema: {
      type: "object",
      properties: {
        tipo_beneficio: {
          type: "string",
          description:
            "Filtra por tipo: aposentadoria_invalidez, auxilio_doenca, bpc_loas, rural, revisao_beneficio, salario_minimo, pensao_morte, acidente_trabalho, aposentadoria_tempo, aposentadoria_especial, calculo_beneficio, prazo_processo. Omitir pra trazer as mudanças recentes mais relevantes de qualquer tipo.",
        },
      },
      required: [],
    },
  },
  {
    name: "listar_etiquetas",
    description:
      "Lista as etiquetas cadastradas no catálogo (formato CATEGORIA:VALOR, ex: FASE:JUDICIAL, PRIORIDADE:URGENTE). Use quando o usuário perguntar 'quais etiquetas temos' ou quiser saber o que já existe antes de aplicar uma.",
    input_schema: {
      type: "object",
      properties: {
        categoria: {
          type: "string",
          description:
            "Filtra só por essa categoria (ex: 'FASE'). Se omitido, traz o catálogo inteiro agrupado por categoria.",
        },
      },
      required: [],
    },
  },
  {
    name: "adicionar_etiqueta",
    description:
      "Aplica uma etiqueta (CATEGORIA:VALOR) a um cliente ou processo, buscando-o pelo nome ou número. Se a etiqueta já existe no catálogo, aplica direto; se for uma etiqueta nova (categoria:valor nunca visto), só administradores podem criá-la.",
    input_schema: {
      type: "object",
      properties: {
        entidade_tipo: {
          type: "string",
          description: "'cliente' ou 'processo'.",
        },
        entidade_busca: {
          type: "string",
          description:
            "Nome do cliente, ou nome do cliente/número do processo (CNJ) pra identificar o processo.",
        },
        categoria: {
          type: "string",
          description: "Categoria da etiqueta, ex: FASE, AREA, PRIORIDADE.",
        },
        valor: {
          type: "string",
          description: "Valor da etiqueta, ex: JUDICIAL, URGENTE.",
        },
      },
      required: ["entidade_tipo", "entidade_busca", "categoria", "valor"],
    },
  },
  {
    name: "remarcar_pericia",
    description:
      "Remarca uma perícia médica ou avaliação social já agendada (Controles → Perícias) pra uma nova data/hora/local, buscando o cliente pelo nome. Atualiza a perícia, sincroniza automaticamente o compromisso correspondente na Agenda (se houver um vinculado) e avisa o cliente (ou responsável legal, se menor/incapaz) por WhatsApp usando o telefone CADASTRADO no sistema — nunca um número lido de um documento anexado na conversa, mesmo que pareça ser do cliente. Se o cliente tiver mais de uma perícia agendada, pergunte ao usuário qual delas antes de chamar esta ferramenta (use tipo_pericia pra desambiguar se souber) em vez de adivinhar.",
    input_schema: {
      type: "object",
      properties: {
        cliente_busca: {
          type: "string",
          description: "Nome (ou parte do nome) do cliente da perícia.",
        },
        tipo_pericia: {
          type: "string",
          description:
            "Opcional, pra desambiguar quando o cliente tem mais de uma perícia agendada: 'medica' (pericia_administrativa) ou 'social' (avaliacao_social_administrativa).",
        },
        nova_data: {
          type: "string",
          description: "Nova data no formato YYYY-MM-DD.",
        },
        nova_hora: {
          type: "string",
          description: "Nova hora no formato HH:MM. Opcional.",
        },
        novo_local: {
          type: "string",
          description:
            "Novo local, se mudou (endereço completo). Opcional — se omitido, mantém o local atual.",
        },
        novo_protocolo: {
          type: "string",
          description:
            "Novo número de protocolo INSS, se o documento remarcado trouxer um. Opcional.",
        },
      },
      required: ["cliente_busca", "nova_data"],
    },
  },
  {
    name: "agendar_pericia",
    description:
      "Agenda uma perícia médica ou avaliação social NOVA do zero (diferente de remarcar_pericia, que só reagenda uma que já existe) — buscando o cliente pelo nome. Cria o compromisso na Agenda, o registro em Perícias, o prazo em Controles, e agenda os lembretes automáticos (15/5/2 dias antes, véspera e dia) pro cliente ou responsável legal usando o telefone CADASTRADO no sistema — nunca um número lido de um documento anexado, mesmo que pareça ser do cliente. Também manda um aviso imediato confirmando o agendamento. Use isto quando o usuário mandar um comprovante de agendamento do INSS (avaliação social, perícia médica) que ainda NÃO está no sistema e pedir pra agendar/marcar. Se já existir uma perícia igual (mesmo cliente, mesma data, mesmo tipo, ainda agendada), a ferramenta recusa como duplicata — nesse caso avise o usuário em vez de insistir.",
    input_schema: {
      type: "object",
      properties: {
        cliente_busca: {
          type: "string",
          description: "Nome (ou parte do nome) do cliente.",
        },
        tipo_pericia: {
          type: "string",
          description:
            "'medica' (perícia médica) ou 'social' (avaliação social BPC/LOAS).",
        },
        data: { type: "string", description: "Data no formato YYYY-MM-DD." },
        hora: {
          type: "string",
          description: "Hora no formato HH:MM. Opcional, padrão 09:00.",
        },
        local: {
          type: "string",
          description: "Local completo (agência/endereço). Opcional.",
        },
        protocolo: {
          type: "string",
          description: "Número de protocolo do INSS, se houver. Opcional.",
        },
        descricao_servico: {
          type: "string",
          description:
            "Descrição do serviço como consta no documento, ex: 'AVALIAÇÃO SOCIAL BPC/LOAS - INICIAL (PRESENCIAL)'. Opcional — se omitido, usa um texto padrão pro tipo.",
        },
      },
      required: ["cliente_busca", "tipo_pericia", "data"],
    },
  },
  {
    name: "criar_controle_pericia",
    description:
      "Cria um registro em Controles → aba 'Perícias e Av. Sociais' pra: perícia médica administrativa/judicial, avaliação social administrativa/judicial, ou o tipo prorrogacao_beneficio (legado — PREFIRA criar_controle com tipo=dcb pra prorrogação de benefício, que grava na aba 'Prorrogação (DCB)', que é onde o usuário de fato confere; só use prorrogacao_beneficio aqui se o usuário pedir explicitamente pra registrar junto de um processo/perícia já existente nesta aba). Diferente de agendar_pericia (só pra agendamento novo do INSS, com compromisso na Agenda e lembretes automáticos por WhatsApp) — este é o registro manual de controle/prazo, igual ao formulário 'Nova Perícia' da tela Controles. Use isto principalmente pra perícia/avaliação JUDICIAL (não INSS) — essas não geram compromisso na Agenda nem lembrete automático.",
    input_schema: {
      type: "object",
      properties: {
        cliente_busca: {
          type: "string",
          description: "Nome (ou parte do nome) do cliente.",
        },
        tipo: {
          type: "string",
          description:
            "Um exatamente destes valores: 'pericia_administrativa', 'pericia_judicial', 'avaliacao_social_administrativa', 'avaliacao_social_judicial', 'prorrogacao_beneficio'.",
        },
        data: {
          type: "string",
          description:
            "Data da perícia/prazo no formato YYYY-MM-DD. Pra prorrogação, é a data-limite pra requerer.",
        },
        hora: { type: "string", description: "Hora HH:MM. Opcional." },
        local: { type: "string", description: "Local. Opcional." },
        perito: { type: "string", description: "Nome do perito. Opcional." },
        especialidade: {
          type: "string",
          description: "Especialidade médica, ex: Ortopedia. Opcional.",
        },
        status: {
          type: "string",
          description:
            "agendado, realizado, remarcado ou cancelado. Opcional, padrão agendado.",
        },
        beneficio_numero: {
          type: "string",
          description:
            "Número do benefício (NB). Só pra prorrogação. Opcional.",
        },
        beneficio_tipo: {
          type: "string",
          description:
            "Tipo do benefício, ex: Auxílio-doença. Só pra prorrogação. Opcional.",
        },
        data_fim_beneficio: {
          type: "string",
          description:
            "Data fim ATUAL do benefício YYYY-MM-DD. Só pra prorrogação. Opcional.",
        },
        nova_data_fim: {
          type: "string",
          description:
            "Nova data fim PRETENDIDA YYYY-MM-DD. Só pra prorrogação. Opcional.",
        },
        observacoes: {
          type: "string",
          description: "Observações internas. Opcional.",
        },
      },
      required: ["cliente_busca", "tipo", "data"],
    },
  },
  {
    name: "cadastrar_cliente",
    description:
      "Cadastra um novo cliente (Pessoa Física ou Jurídica) direto pelo chat, no mesmo padrão do 'cadastro rápido' da tela de Clientes: nome, documento e tipo são obrigatórios; endereço fica com placeholder até alguém completar depois na tela do cliente. SEMPRE confirme nome completo e CPF/CNPJ com quem está pedindo antes de chamar esta ferramenta — nunca invente ou arredonde um documento. Se o cliente for menor de idade ou incapaz, informe menor_incapaz=true e os dados do responsável legal (nome e telefone são obrigatórios nesse caso) — é pra esse telefone que todo aviso automático desse cliente vai, nunca pro documento/CPF do próprio menor. Se o documento/mensagem que originou o cadastro já trouxer dado de RG, nascimento, NIS, benefício, CID ou incapacidade (comum quando o cadastro vem de uma decisão/comunicação do INSS), preencha os campos previdenciários abaixo NA HORA do cadastro — não deixe pra uma chamada separada de complementar_cliente depois, ela é só pra cliente que já existe.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          description: "'PF' (pessoa física) ou 'PJ' (pessoa jurídica).",
        },
        name: {
          type: "string",
          description: "Nome completo (PF) ou razão social (PJ).",
        },
        doc: { type: "string", description: "CPF (PF) ou CNPJ (PJ)." },
        email: { type: "string", description: "E-mail do cliente. Opcional." },
        phone: {
          type: "string",
          description:
            "Telefone/WhatsApp do cliente. Opcional, mas recomendado.",
        },
        city: { type: "string", description: "Cidade. Opcional." },
        state: { type: "string", description: "UF (2 letras). Opcional." },
        notes: {
          type: "string",
          description: "Observações rápidas. Opcional.",
        },
        rg: { type: "string", description: "RG. Opcional." },
        rg_orgao: {
          type: "string",
          description: "Órgão expedidor do RG. Opcional.",
        },
        birth_date: {
          type: "string",
          description: "Data de nascimento YYYY-MM-DD. Opcional.",
        },
        genero: {
          type: "string",
          description: "Masculino ou Feminino. Opcional.",
        },
        filiacao_mae: { type: "string", description: "Nome da mãe. Opcional." },
        filiacao_pai: { type: "string", description: "Nome do pai. Opcional." },
        naturalidade_cidade: {
          type: "string",
          description: "Cidade de nascimento (naturalidade). Opcional.",
        },
        naturalidade_estado: {
          type: "string",
          description: "UF de nascimento (naturalidade). Opcional.",
        },
        nis: { type: "string", description: "NIS/PIS/PASEP. Opcional." },
        num_beneficio: {
          type: "string",
          description: "Número do benefício INSS. Opcional.",
        },
        tipo_beneficio: {
          type: "string",
          description:
            "Tipo de benefício, ex: Auxílio-doença, BPC/LOAS. Opcional.",
        },
        status_beneficio: {
          type: "string",
          description: "ativo, suspenso, cessado ou nao_recebe. Opcional.",
        },
        data_inicio_beneficio: {
          type: "string",
          description:
            "Data de início do benefício (DIB) YYYY-MM-DD. Opcional.",
        },
        valor_beneficio: {
          type: "string",
          description:
            "Valor do benefício em reais, só número (ex: 1518.00). Opcional.",
        },
        cid_principal: {
          type: "string",
          description: "Código CID-10 do diagnóstico principal. Opcional.",
        },
        tipo_incapacidade: {
          type: "string",
          description: "permanente, temporaria ou nao_se_aplica. Opcional.",
        },
        data_diagnostico: {
          type: "string",
          description: "Data do diagnóstico médico YYYY-MM-DD. Opcional.",
        },
        data_afastamento: {
          type: "string",
          description: "Data de afastamento do trabalho YYYY-MM-DD. Opcional.",
        },
        categoria_contribuinte: {
          type: "string",
          description:
            "empregado, individual, especial, avulso ou facultativo. Opcional.",
        },
        num_contribuicoes: {
          type: "string",
          description: "Número de contribuições/carência, só número. Opcional.",
        },
        menor_incapaz: {
          type: "string",
          description:
            "'true' se o cliente é menor de idade ou incapaz. Opcional, padrão false.",
        },
        responsavel_nome: {
          type: "string",
          description:
            "Nome do responsável legal. Obrigatório se menor_incapaz=true.",
        },
        responsavel_telefone: {
          type: "string",
          description:
            "Telefone do responsável legal. Obrigatório se menor_incapaz=true.",
        },
        responsavel_parentesco: {
          type: "string",
          description:
            "Parentesco do responsável (ex: mãe, pai, tutor). Opcional.",
        },
        responsavel_cpf: {
          type: "string",
          description:
            "CPF do responsável legal. Opcional, mas necessário pra gerar contrato com responsável — peça se estiver tratando de um caso assim.",
        },
        responsavel_rg: {
          type: "string",
          description: "RG do responsável legal. Opcional.",
        },
        responsavel_rg_orgao: {
          type: "string",
          description: "Órgão expedidor do RG do responsável legal. Opcional.",
        },
        responsavel_email: {
          type: "string",
          description: "E-mail do responsável legal. Opcional.",
        },
      },
      required: ["tipo", "name", "doc"],
    },
  },
  {
    name: "complementar_cliente",
    description:
      "Preenche automaticamente campos VAZIOS no cadastro de um cliente JÁ EXISTENTE, a partir de dado reconhecido num documento anexado na conversa ou informado pelo usuário no texto. Use isto PROATIVAMENTE, sem esperar o usuário pedir, sempre que reconhecer dado novo de identificação/endereço/benefício/saúde de um cliente que já existe no sistema (não é pra cadastro novo — pra isso use cadastrar_cliente). Só preenche campo que estiver vazio — nunca sobrescreve dado que já existe, mesmo que pareça diferente do que você leu; se notar uma divergência entre o que já está cadastrado e o que o documento mostra, avise o usuário em texto em vez de tentar corrigir sozinho. Não invente valor nenhum — só informe campos que você viu de verdade no documento/mensagem. IMPORTANTE pra clientes menor/incapaz: a tela de Assinaturas escolhe sozinha entre o modelo de contrato 'com responsável legal' e o 'sem responsável' — mas só funciona direito se o CPF e RG do responsável também estiverem cadastrados (não só nome/telefone). Se perceber que o cliente é menor_incapaz e faltam responsavel_cpf/responsavel_rg, pergunte proativamente por esses dados quando fizer sentido na conversa.",
    input_schema: {
      type: "object",
      properties: {
        cliente_busca: {
          type: "string",
          description: "Nome (ou parte do nome) do cliente a completar.",
        },
        doc: { type: "string", description: "CPF/CNPJ. Opcional." },
        rg: { type: "string", description: "RG. Opcional." },
        rg_orgao: {
          type: "string",
          description: "Órgão expedidor do RG. Opcional.",
        },
        birth_date: {
          type: "string",
          description: "Data de nascimento YYYY-MM-DD. Opcional.",
        },
        genero: {
          type: "string",
          description: "Masculino ou Feminino. Opcional.",
        },
        filiacao_mae: { type: "string", description: "Nome da mãe. Opcional." },
        filiacao_pai: { type: "string", description: "Nome do pai. Opcional." },
        cep: { type: "string", description: "CEP. Opcional." },
        street: { type: "string", description: "Logradouro. Opcional." },
        addr_number: {
          type: "string",
          description: "Número do endereço. Opcional.",
        },
        complement: {
          type: "string",
          description: "Complemento do endereço. Opcional.",
        },
        neighborhood: { type: "string", description: "Bairro. Opcional." },
        city: { type: "string", description: "Cidade. Opcional." },
        state: { type: "string", description: "UF. Opcional." },
        phone: { type: "string", description: "Telefone/WhatsApp. Opcional." },
        email: { type: "string", description: "E-mail. Opcional." },
        nis: { type: "string", description: "NIS/PIS/PASEP. Opcional." },
        num_beneficio: {
          type: "string",
          description: "Número do benefício INSS. Opcional.",
        },
        tipo_beneficio: {
          type: "string",
          description:
            "Tipo de benefício, ex: Auxílio-doença, BPC/LOAS. Opcional.",
        },
        cid_principal: {
          type: "string",
          description: "Código CID-10 do diagnóstico principal. Opcional.",
        },
        tipo_incapacidade: {
          type: "string",
          description: "permanente, temporaria ou nao_se_aplica. Opcional.",
        },
        data_afastamento: {
          type: "string",
          description: "Data de afastamento do trabalho YYYY-MM-DD. Opcional.",
        },
        naturalidade_cidade: {
          type: "string",
          description: "Cidade de nascimento (naturalidade). Opcional.",
        },
        naturalidade_estado: {
          type: "string",
          description: "UF de nascimento (naturalidade). Opcional.",
        },
        status_beneficio: {
          type: "string",
          description: "ativo, suspenso, cessado ou nao_recebe. Opcional.",
        },
        data_inicio_beneficio: {
          type: "string",
          description:
            "Data de início do benefício (DIB) YYYY-MM-DD. Opcional.",
        },
        valor_beneficio: {
          type: "string",
          description:
            "Valor do benefício em reais, só número (ex: 1518.00). Opcional.",
        },
        categoria_contribuinte: {
          type: "string",
          description:
            "empregado, individual, especial, avulso ou facultativo. Opcional.",
        },
        data_diagnostico: {
          type: "string",
          description: "Data do diagnóstico médico YYYY-MM-DD. Opcional.",
        },
        num_contribuicoes: {
          type: "string",
          description: "Número de contribuições/carência, só número. Opcional.",
        },
        responsavel_nome: {
          type: "string",
          description: "Nome do responsável legal (menor/incapaz). Opcional.",
        },
        responsavel_telefone: {
          type: "string",
          description: "Telefone do responsável legal. Opcional.",
        },
        responsavel_parentesco: {
          type: "string",
          description:
            "Parentesco do responsável, ex: mãe, pai, tutor. Opcional.",
        },
        responsavel_cpf: {
          type: "string",
          description:
            "CPF do responsável legal — necessário pra gerar contrato com responsável. Opcional.",
        },
        responsavel_rg: {
          type: "string",
          description: "RG do responsável legal. Opcional.",
        },
        responsavel_rg_orgao: {
          type: "string",
          description: "Órgão expedidor do RG do responsável legal. Opcional.",
        },
        responsavel_email: {
          type: "string",
          description: "E-mail do responsável legal. Opcional.",
        },
      },
      required: ["cliente_busca"],
    },
  },
  {
    name: "criar_controle",
    description:
      "Cria um item na tela Controles (fora de Perícias — pra isso use agendar_pericia/criar_controle_pericia). Cobre os tipos: 'audiencias' (Audiências), 'prazos' (Prazos Processuais), 'dcb' (Prorrogação/DCB — prazo pra requerer prorrogação antes da cessação do benefício), 'beneficios' (Benefícios — Ag. Implantação), 'implantados' (Benefícios Implantados (1° Pag.)), 'implantados-data' (Benefícios Implantados — informar data_1pag e/ou data_cessacao cria também, automaticamente, um controle 'implantados' e um 'dcb' vinculados, 15 dias antes da cessação, mesmo comportamento da tela manual), 'alvaras' (Alvarás/RPVs). Sempre vinculado a um cliente; processo é opcional mas recomendado quando o prazo for de um processo específico.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          description:
            "Um de: audiencias, prazos, dcb, beneficios, implantados, implantados-data, alvaras.",
        },
        cliente_busca: {
          type: "string",
          description: "Nome (ou parte do nome) do cliente.",
        },
        processo_busca: {
          type: "string",
          description:
            "Número (ou parte) do processo do cliente pra vincular. Opcional.",
        },
        data_evento: {
          type: "string",
          description:
            "Data do prazo/evento, YYYY-MM-DD. Obrigatório pra todos os tipos exceto 'implantados-data' (que usa data_1pag/data_cessacao).",
        },
        descricao: {
          type: "string",
          description:
            "Descrição do item (ex: 'Audiência de instrução', 'Prazo para recurso', 'RPV expedido'). Obrigatório pra prazos/beneficios/implantados/alvaras; opcional pra audiencias/dcb/implantados-data.",
        },
        prazo_interno: {
          type: "string",
          description:
            "Data-limite interna do escritório pra agir, se diferente da data_evento (YYYY-MM-DD). Opcional.",
        },
        prioridade: {
          type: "string",
          description: "baixa, media ou alta. Opcional, padrão media.",
        },
        fatal: {
          type: "string",
          description:
            "'true' se perder esse prazo encerra direito do cliente (ex: prazo recursal, DCB) — dispara alerta imediato por WhatsApp pro escritório. Opcional, padrão false.",
        },
        observacoes: {
          type: "string",
          description: "Observações livres. Opcional.",
        },
        tipo_demanda: {
          type: "string",
          description: "Judicial, Extrajudicial ou Consultiva. Opcional.",
        },
        hora: {
          type: "string",
          description:
            "Hora da audiência, HH:MM. Só pra tipo=audiencias. Opcional.",
        },
        local_titulo: {
          type: "string",
          description:
            "Local/vara da audiência (texto livre). Só pra tipo=audiencias. Opcional.",
        },
        data_1pag: {
          type: "string",
          description:
            "Data do 1° pagamento do benefício, YYYY-MM-DD. Só pra tipo=implantados-data. Opcional.",
        },
        data_cessacao: {
          type: "string",
          description:
            "Data em que o benefício cessa, YYYY-MM-DD. Só pra tipo=implantados-data — cria automaticamente um DCB 15 dias antes dessa data. Opcional.",
        },
      },
      required: ["tipo", "cliente_busca"],
    },
  },
];

/** Ferramentas que executam mudança real no sistema — exigem configuracoes:editar. */
const FERRAMENTAS_MUTANTES = new Set([
  "sincronizar_publicacoes",
  "reenviar_mensagens_falhadas",
  "reenviar_lembretes",
  "cancelar_lembretes_atrasados",
  "adicionar_oab",
  "remover_oab",
  "atualizar_escritorio",
  "testar_whatsapp",
]);

/**
 * Diagnóstico/config do sistema (inclui log de WhatsApp com nome+telefone
 * de cliente em ver_erros) — mesmo padrão do antigo "Agente do Sistema",
 * que era 100% restrito a administrador. Ao fundir tudo na Íris, esse
 * gate quase ficou de fora (só as mutantes continuaram checadas) — um
 * usuário sem privilégio de admin conseguiria puxar esses dados
 * operacionais/PII só perguntando. Corrigido: exige configuracoes:ver.
 */
const FERRAMENTAS_DIAGNOSTICO = new Set([
  "verificar_saude",
  "obter_estatisticas",
  "ver_erros",
  "listar_oabs",
]);

export async function executarFerramentaIris(
  session: SessionUser,
  name: string,
  input: Record<string, string>
): Promise<string> {
  if (
    FERRAMENTAS_MUTANTES.has(name) &&
    !hasPermission(session, "configuracoes", "editar")
  ) {
    return JSON.stringify({
      ok: false,
      erro: "Este usuário não tem permissão de administrador para executar essa ação. Explique isso educadamente e não tente de novo.",
    });
  }
  if (
    FERRAMENTAS_DIAGNOSTICO.has(name) &&
    !hasPermission(session, "configuracoes", "ver")
  ) {
    return JSON.stringify({
      ok: false,
      erro: "Este usuário não tem permissão pra ver dados de diagnóstico/configuração do sistema. Explique isso educadamente e não tente de novo.",
    });
  }
  if (
    name === "consultar_financeiro" &&
    !hasPermission(session, "financeiro", "ver")
  ) {
    return JSON.stringify({
      ok: false,
      erro: "Este usuário não tem permissão pra ver dados financeiros do escritório. Explique isso educadamente e não tente de novo.",
    });
  }
  if (
    (name === "listar_processos_risco" ||
      name === "consultar_analise_cerebro") &&
    !hasPermission(session, "processos", "ver")
  ) {
    return JSON.stringify({
      ok: false,
      erro: "Este usuário não tem permissão pra ver processos. Explique isso educadamente e não tente de novo.",
    });
  }

  // Rede de segurança: qualquer query sem .catch() próprio (várias existem
  // nos casos de busca de cliente/processo) que lançar uma exceção aqui
  // subia sem tratamento até a rota do chat, que só tem um catch GERAL em
  // volta de toda a conversa — resultado: "Erro ao gerar resposta" genérico
  // pro usuário, sem log específico de qual ferramenta/linha falhou.
  try {
    return await executarFerramentaIrisInterno(session, name, input);
  } catch (err) {
    console.error(
      `[iris-tools] exceção não tratada na ferramenta "${name}":`,
      err
    );
    return JSON.stringify({
      ok: false,
      erro: `Erro interno ao executar "${name}". Avise o usuário que algo falhou e ele pode tentar de novo ou fazer manualmente pela tela.`,
    });
  }
}

/**
 * DCB (Prorrogação — Controles → aba "Prorrogação (DCB)") é o prazo mais
 * crítico do escritório (perder = cliente perde o benefício), mas até
 * aqui só existia como registro passivo — sem aparecer na Agenda nem
 * gerar lembrete automático. Cria compromisso + agenda lembrete pro
 * escritório, mesmo padrão já usado pra prorrogacao_beneficio em
 * criar_controle_pericia. Usada tanto pra DCB manual quanto pro DCB
 * criado em cascata a partir de implantados-data.
 */
async function criarCompromissoLembreteDcb(opts: {
  controleId: string;
  clienteId: string;
  clienteNome: string;
  data: string;
  criadoPorLogin: string;
}): Promise<boolean> {
  try {
    const titulo = `Prorrogação (DCB) — ${opts.clienteNome}`;
    const [compromisso] = await sql`
      INSERT INTO compromissos (titulo, tipo, data_inicio, criado_por, cliente_id)
      VALUES (${titulo}, 'outro', ${opts.data}::date, ${opts.criadoPorLogin}, ${opts.clienteId}::uuid)
      RETURNING id::text
    `;
    const compromissoId = String(compromisso.id);
    await sql`
      UPDATE controles
      SET dados = COALESCE(dados, '{}'::jsonb) || jsonb_build_object('compromisso_id', ${compromissoId}::text)
      WHERE id = ${opts.controleId}::uuid
    `;

    const [escritorio] =
      await sql`SELECT nome, telefone FROM escritorio_config LIMIT 1`;
    const telefoneEscritorio = String(escritorio?.telefone ?? "").trim();
    if (!telefoneEscritorio) return false;

    const { agendarLembretesCompromissoPrevBot } = await import("./lembretes");
    await agendarLembretesCompromissoPrevBot({
      compromissoId,
      titulo,
      dataEvento: new Date(opts.data + "T12:00:00"),
      hora: null,
      local: null,
      colaboradorTelefone: telefoneEscritorio,
      colaboradorNome: String(escritorio?.nome ?? "Escritório"),
      clienteNome: opts.clienteNome,
    });
    return true;
  } catch (e) {
    console.error("[iris-tools] falha ao agendar lembrete de DCB:", e);
    return false;
  }
}

async function executarFerramentaIrisInterno(
  session: SessionUser,
  name: string,
  input: Record<string, string>
): Promise<string> {
  switch (name) {
    case "verificar_saude": {
      const checks: { componente: string; ok: boolean; detalhe: string }[] = [];

      try {
        await sql`SELECT 1`;
        checks.push({
          componente: "Banco de dados (Neon)",
          ok: true,
          detalhe: "Conectado",
        });
      } catch {
        checks.push({
          componente: "Banco de dados (Neon)",
          ok: false,
          detalhe: "Erro de conexão",
        });
      }

      const envVars = [
        { key: "ANTHROPIC_API_KEY", label: "IA (Claude)" },
        { key: "PREVBOT_WEBHOOK_URL", label: "WhatsApp (PrevBot)" },
        { key: "RESEND_API_KEY", label: "E-mail (Resend)" },
        { key: "TRAMITASIGN_WEBHOOK_SECRET", label: "TramitaSign webhook" },
      ];
      for (const { key, label } of envVars) {
        const val = process.env[key];
        checks.push({
          componente: label,
          ok: !!val && val.length > 0,
          detalhe:
            !!val && val.length > 0 ? "Configurado" : `${key} não configurado`,
        });
      }

      const [oabs, pubs, fila] = await Promise.all([
        sql`SELECT COUNT(*) as total, SUM(CASE WHEN ativa THEN 1 ELSE 0 END)::int as ativas FROM oabs_monitoradas`,
        sql`SELECT COUNT(*) as total FROM publicacoes WHERE status = 'nao_lida'`,
        sql`SELECT COUNT(*) as total FROM prevbot_webhook_log WHERE status = 'pendente'`,
      ]);

      checks.push({
        componente: "OABs monitoradas",
        ok: Number(oabs[0].ativas) > 0,
        detalhe: `${oabs[0].ativas} ativas de ${oabs[0].total} cadastradas`,
      });
      checks.push({
        componente: "Publicações não lidas",
        ok: true,
        detalhe: `${pubs[0].total} aguardando tratamento`,
      });
      checks.push({
        componente: "Fila WhatsApp",
        ok: Number(fila[0].total) === 0,
        detalhe:
          Number(fila[0].total) === 0
            ? "Nenhuma pendente"
            : `${fila[0].total} mensagens na fila`,
      });

      const { getCronsAtrasados } = await import("./saude-sistema");
      const cronsAtrasados = (await getCronsAtrasados()).filter(
        (c) => c.atrasado
      );
      checks.push({
        componente: "Rotinas automáticas (crons)",
        ok: cronsAtrasados.length === 0,
        detalhe:
          cronsAtrasados.length === 0
            ? "Todas rodando em dia"
            : `Atrasadas: ${cronsAtrasados.map((c) => `${c.rota} (última: ${c.ultimaExecucao ?? "nunca"})`).join(", ")}`,
      });

      return JSON.stringify(checks);
    }

    case "obter_estatisticas": {
      const [clientes, processos, pubs, leads, oabs] = await Promise.all([
        sql`SELECT COUNT(*) as total FROM clients`,
        sql`SELECT COUNT(*) as total FROM processos WHERE deleted_at IS NULL`,
        sql`SELECT COUNT(*) as total, SUM(CASE WHEN status = 'nao_lida' THEN 1 ELSE 0 END)::int as nao_lidas FROM publicacoes`,
        sql`SELECT COUNT(*) as total FROM crm_leads`,
        sql`SELECT COUNT(*) as total FROM oabs_monitoradas WHERE ativa = true`,
      ]);
      return JSON.stringify({
        clientes: clientes[0].total,
        processos: processos[0].total,
        publicacoes_total: pubs[0].total,
        publicacoes_nao_lidas: pubs[0].nao_lidas,
        leads_crm: leads[0].total,
        oabs_ativas: oabs[0].total,
      });
    }

    case "sincronizar_publicacoes": {
      let total = 0;
      const fontes: string[] = [];

      const { sincronizarDJEN } = await import("./djen");
      const djen = await sincronizarDJEN(7).catch(() => 0);
      total += djen;
      fontes.push(`DJEN/TRF5: +${djen}`);

      const { buscarPublicacoesDjeEsaj } = await import("./dje-esaj");
      const oabs =
        await sql`SELECT id::text, numero, estado, nome_advogado FROM oabs_monitoradas WHERE ativa = true`;
      let dje = 0;
      for (const oab of oabs) {
        dje += await buscarPublicacoesDjeEsaj(
          {
            id: String(oab.id),
            numero: String(oab.numero),
            estado: String(oab.estado),
            nome_advogado: oab.nome_advogado ? String(oab.nome_advogado) : null,
          },
          7
        ).catch(() => 0);
      }
      total += dje;
      fontes.push(`DJe/eSAJ: +${dje}`);

      const { sincronizarTramitaSign, tramitaSyncAtivo } =
        await import("./tramitasign-sync");
      if (tramitaSyncAtivo()) {
        const ts = await sincronizarTramitaSign(7).catch(() => ({
          inseridos: 0,
        }));
        total += ts.inseridos;
        fontes.push(`TramitaSign: +${ts.inseridos}`);
      } else {
        fontes.push("TramitaSign: sem credenciais");
      }

      return JSON.stringify({ total_novas: total, fontes });
    }

    case "reenviar_mensagens_falhadas": {
      const webhookKey =
        process.env.PREVBOT_WEBHOOK_KEY ?? process.env.PREVBOT_API_KEY;
      if (!webhookKey)
        return JSON.stringify({ erro: "PREVBOT_WEBHOOK_KEY não configurada" });
      const { _enviarWebhook } = await import("./prevbot-outbound");

      const pendentes = await sql`
        SELECT id::text, payload, tentativas FROM prevbot_webhook_log
        WHERE status = 'pendente' AND tentativas < 3
        ORDER BY created_at ASC LIMIT 20
      `;

      let enviados = 0,
        falhos = 0;
      for (const row of pendentes) {
        const resultado = await _enviarWebhook(
          webhookKey,
          row.payload as Record<string, unknown>
        );
        const novasTentativas = Number(row.tentativas) + 1;
        if (resultado.ok) {
          await sql`UPDATE prevbot_webhook_log SET status = 'enviado', tentativas = ${novasTentativas}, enviado_em = NOW() WHERE id = ${String(row.id)}::uuid`;
          enviados++;
        } else {
          const novoStatus = novasTentativas >= 3 ? "falhou" : "pendente";
          await sql`UPDATE prevbot_webhook_log SET tentativas = ${novasTentativas}, status = ${novoStatus} WHERE id = ${String(row.id)}::uuid`;
          falhos++;
        }
      }
      return JSON.stringify({
        processadas: pendentes.length,
        enviadas: enviados,
        falharam: falhos,
      });
    }

    case "listar_oabs": {
      const oabs =
        await sql`SELECT numero, estado, nome_advogado, ativa, ultima_busca FROM oabs_monitoradas ORDER BY estado, numero`;
      return JSON.stringify(
        oabs.map((o) => ({
          numero: o.numero,
          estado: o.estado,
          nome: o.nome_advogado ?? "—",
          ativa: o.ativa,
          ultima_busca: o.ultima_busca
            ? new Date(o.ultima_busca as string).toLocaleDateString("pt-BR")
            : "Nunca",
        }))
      );
    }

    case "adicionar_oab": {
      const numero = String(input.numero ?? "").replace(/\D/g, "");
      const estado = String(input.estado ?? "")
        .toUpperCase()
        .slice(0, 2);
      const nome_advogado = input.nome_advogado
        ? String(input.nome_advogado).trim().slice(0, 120)
        : null;
      if (!numero || !/^[A-Z]{2}$/.test(estado))
        return JSON.stringify({
          ok: false,
          mensagem: "Número da OAB ou UF inválidos.",
        });
      const existe =
        await sql`SELECT id FROM oabs_monitoradas WHERE numero = ${numero} AND estado = ${estado}`;
      if (existe.length > 0)
        return JSON.stringify({
          ok: false,
          mensagem: `OAB ${numero}/${estado} já cadastrada`,
        });
      await sql`INSERT INTO oabs_monitoradas (numero, estado, nome_advogado, ativa) VALUES (${numero}, ${estado}, ${nome_advogado ?? null}, true)`;
      return JSON.stringify({
        ok: true,
        mensagem: `OAB ${numero}/${estado} adicionada com sucesso`,
      });
    }

    case "remover_oab": {
      const { numero, estado } = input;
      const deletedRows =
        await sql`DELETE FROM oabs_monitoradas WHERE numero = ${numero} AND estado = ${estado} RETURNING id`;
      return JSON.stringify({
        ok: true,
        mensagem:
          deletedRows.length > 0
            ? `OAB ${numero}/${estado} removida`
            : "OAB não encontrada",
      });
    }

    case "atualizar_escritorio": {
      const campo = String(input.campo ?? "");
      const valor = String(input.valor ?? "")
        .trim()
        .slice(0, 300);
      switch (campo) {
        case "telefone":
          await sql`UPDATE escritorio_config SET telefone = ${valor}`;
          break;
        case "email":
          await sql`UPDATE escritorio_config SET email = ${valor}`;
          break;
        case "nome":
          await sql`UPDATE escritorio_config SET nome = ${valor}`;
          break;
        case "cidade":
          await sql`UPDATE escritorio_config SET cidade = ${valor}`;
          break;
        case "estado":
          await sql`UPDATE escritorio_config SET estado = ${valor}`;
          break;
        case "endereco":
          await sql`UPDATE escritorio_config SET endereco = ${valor}`;
          break;
        case "oab":
          await sql`UPDATE escritorio_config SET oab = ${valor}`;
          break;
        case "cnpj":
          await sql`UPDATE escritorio_config SET cnpj = ${valor}`;
          break;
        case "site":
          await sql`UPDATE escritorio_config SET site = ${valor}`;
          break;
        case "cep":
          await sql`UPDATE escritorio_config SET cep = ${valor}`;
          break;
        default:
          return JSON.stringify({
            ok: false,
            mensagem: `Campo "${campo}" não permitido`,
          });
      }
      return JSON.stringify({
        ok: true,
        mensagem: `${campo} atualizado para "${valor}"`,
      });
    }

    case "testar_whatsapp": {
      const digitos = String(input.telefone ?? "").replace(/\D/g, "");
      if (digitos.length < 10 || digitos.length > 13)
        return JSON.stringify({
          ok: false,
          error: "Telefone inválido (informe DDD + número).",
        });
      const mensagem = String(input.mensagem ?? "")
        .trim()
        .slice(0, 1000);
      if (!mensagem)
        return JSON.stringify({ ok: false, error: "Mensagem vazia." });
      const resultado = await enviarMensagemDireta({
        telefone: digitos,
        mensagem,
      });
      return JSON.stringify(resultado);
    }

    case "cancelar_lembretes_atrasados": {
      const [{ total }] = await sql`
        SELECT COUNT(*)::int AS total
        FROM lembretes_agendados
        WHERE NOT enviado AND enviar_em <= NOW()
      `;
      await sql`
        UPDATE lembretes_agendados
        SET enviado = TRUE, enviado_em = NOW(), erro = 'cancelado_manualmente'
        WHERE NOT enviado
          AND enviar_em <= NOW()
      `;
      return JSON.stringify({
        ok: true,
        cancelados: total,
        mensagem:
          total > 0
            ? `${total} lembrete${Number(total) !== 1 ? "s" : ""} antigo${Number(total) !== 1 ? "s" : ""} cancelado${Number(total) !== 1 ? "s" : ""} sem envio.`
            : "Nenhum lembrete atrasado encontrado.",
      });
    }

    case "ver_erros": {
      const { getLoginFalhosRecentes } = await import("./saude-sistema");
      const [
        resumoCRM,
        errosCRM,
        resumoLembretes,
        errosLembretes,
        loginsFalhos,
      ] = await Promise.all([
        sql`SELECT status, COUNT(*) as total FROM prevbot_webhook_log GROUP BY status ORDER BY total DESC`,
        sql`
            SELECT payload->>'evento' as evento, status, ultimo_erro, tentativas, created_at::text
            FROM prevbot_webhook_log WHERE status IN ('pendente', 'falhou')
            ORDER BY created_at DESC LIMIT 5
          `,
        sql`
            SELECT enviado, COUNT(*) as total,
                   SUM(CASE WHEN tentativas >= 3 AND NOT enviado THEN 1 ELSE 0 END)::int as bloqueados
            FROM lembretes_agendados
            GROUP BY enviado
          `,
        sql`
            SELECT tipo, destinatario_nome, destinatario_telefone, erro,
                   tentativas, enviar_em::text, enviado
            FROM lembretes_agendados
            WHERE (NOT enviado AND enviar_em <= NOW()) OR erro IS NOT NULL
            ORDER BY enviar_em DESC LIMIT 10
          `,
        getLoginFalhosRecentes(24),
      ]);
      return JSON.stringify({
        crm_webhook: { resumo: resumoCRM, erros_recentes: errosCRM },
        lembretes_whatsapp: {
          resumo: resumoLembretes,
          pendentes_com_erro: errosLembretes,
        },
        seguranca: {
          tentativas_login_falhas_24h: loginsFalhos,
          observacao:
            loginsFalhos > 20
              ? "Volume alto — pode indicar tentativa de força bruta."
              : "Dentro do esperado.",
        },
      });
    }

    case "reenviar_lembretes": {
      const pendentes = await sql`
        SELECT id::text, destinatario_telefone, mensagem, tipo, tentativas
        FROM lembretes_agendados
        WHERE NOT enviado
          AND enviar_em <= NOW()
          AND tentativas < 3
        ORDER BY enviar_em ASC
        LIMIT 30
      `;

      if (pendentes.length === 0)
        return JSON.stringify({
          ok: true,
          mensagem: "Nenhuma mensagem pendente no momento.",
        });

      let enviados = 0;
      let falhos = 0;
      const erros: string[] = [];

      for (const lembrete of pendentes) {
        const id = String(lembrete.id);
        const telefone = String(lembrete.destinatario_telefone ?? "");
        const mensagem = String(lembrete.mensagem ?? "");

        if (!telefone || !mensagem) {
          await sql`UPDATE lembretes_agendados SET enviado = TRUE, enviado_em = NOW(), erro = 'telefone ou mensagem vazio' WHERE id = ${id}::uuid`;
          continue;
        }

        const resultado = await enviarMensagemDireta({ telefone, mensagem });
        const novasTentativas = Number(lembrete.tentativas) + 1;

        if (resultado.ok) {
          await sql`UPDATE lembretes_agendados SET enviado = TRUE, enviado_em = NOW(), tentativas = ${novasTentativas} WHERE id = ${id}::uuid`;
          enviados++;
        } else {
          await sql`UPDATE lembretes_agendados SET tentativas = ${novasTentativas}, erro = ${resultado.error ?? "erro desconhecido"} WHERE id = ${id}::uuid`;
          falhos++;
          if (erros.length < 3)
            erros.push(`${lembrete.tipo}: ${resultado.error}`);
        }
      }

      return JSON.stringify({
        processados: pendentes.length,
        enviados,
        falhos,
        erros_amostra: erros,
      });
    }

    case "consultar_financeiro": {
      const kpis = await getLancamentoKpis();
      const contas = await getContasAReceber();

      const cliente_nome =
        typeof input.cliente_nome === "string" ? input.cliente_nome.trim() : "";
      if (cliente_nome) {
        const termo = cliente_nome.toLowerCase();
        const encontrados = contas.filter((c) =>
          c.client_name.toLowerCase().includes(termo)
        );
        if (encontrados.length === 0) {
          return JSON.stringify({
            mensagem: `Nenhum cliente encontrado com o nome "${cliente_nome}".`,
          });
        }
        return JSON.stringify({
          clientes: encontrados.map((c) => ({
            nome: c.client_name,
            documento: c.client_doc,
            total_pendente: c.totalPendente,
            total_pago: c.totalPago,
            lancamentos: c.items.slice(0, 20),
          })),
        });
      }

      return JSON.stringify({
        kpis_gerais: kpis,
        maiores_pendencias: contas.slice(0, 10).map((c) => ({
          nome: c.client_name,
          total_pendente: c.totalPendente,
          total_pago: c.totalPago,
        })),
      });
    }

    case "listar_processos_risco": {
      const riscoFiltro =
        typeof input.risco === "string" ? input.risco.trim().toLowerCase() : "";
      const podeVerTodos = hasPermission(session, "processos_ver_todos", "ver");
      const colaboradorId = podeVerTodos
        ? null
        : await getColaboradorIdForUser(session.id);
      const rows = await sql`
        SELECT DISTINCT ON (ca.processo_id)
          ca.processo_id::text, ca.risco, ca.probabilidade_sucesso,
          ca.proxima_acao, ca.created_at::text AS criado_em,
          p.numero AS processo_numero, cl.name AS cliente_nome
        FROM cerebro_analises ca
        JOIN processos p ON p.id = ca.processo_id
        LEFT JOIN clients cl ON cl.id = p.client_id
        WHERE ca.tipo = 'inicial'
          AND ca.risco IS NOT NULL
          AND p.status NOT IN ('arquivado', 'encerrado')
          AND p.deleted_at IS NULL
          AND (${riscoFiltro} = '' OR ca.risco = ${riscoFiltro})
          AND (${podeVerTodos} OR p.responsavel_id = ${colaboradorId}::uuid)
        ORDER BY ca.processo_id, ca.created_at DESC
      `;
      const ordem: Record<string, number> = { alto: 0, medio: 1, baixo: 2 };
      const ordenado = rows
        .map((r) => ({
          processo_numero: r.processo_numero ?? "—",
          cliente_nome: r.cliente_nome ?? "—",
          risco: r.risco,
          probabilidade_sucesso: r.probabilidade_sucesso,
          proxima_acao: r.proxima_acao,
        }))
        .sort(
          (a, b) =>
            (ordem[String(a.risco)] ?? 3) - (ordem[String(b.risco)] ?? 3)
        );
      return JSON.stringify({
        total: ordenado.length,
        processos: ordenado.slice(0, 30),
      });
    }

    case "consultar_analise_cerebro": {
      const busca = String(input.busca ?? "").trim();
      if (!busca)
        return JSON.stringify({
          erro: "Informe um nome de cliente ou número de processo.",
        });
      const podeVerTodos2 = hasPermission(
        session,
        "processos_ver_todos",
        "ver"
      );
      const colaboradorId2 = podeVerTodos2
        ? null
        : await getColaboradorIdForUser(session.id);
      const rows = await sql`
        SELECT ca.titulo, ca.risco, ca.probabilidade_sucesso, ca.proxima_acao,
               ca.base_legal, ca.created_at::text AS criado_em,
               p.numero AS processo_numero, cl.name AS cliente_nome
        FROM cerebro_analises ca
        JOIN processos p ON p.id = ca.processo_id
        LEFT JOIN clients cl ON cl.id = p.client_id
        WHERE ca.tipo = 'inicial'
          AND p.deleted_at IS NULL
          AND (cl.name ILIKE ${"%" + busca + "%"} OR p.numero ILIKE ${"%" + busca + "%"})
          AND (${podeVerTodos2} OR p.responsavel_id = ${colaboradorId2}::uuid)
        ORDER BY ca.created_at DESC
        LIMIT 5
      `;
      if (rows.length === 0)
        return JSON.stringify({
          mensagem: `Nenhuma análise do Cérebro Jurídico encontrada para "${busca}".`,
        });
      return JSON.stringify({
        analises: rows.map((r) => ({
          cliente: r.cliente_nome ?? "—",
          processo: r.processo_numero ?? "—",
          risco: r.risco,
          probabilidade_sucesso: r.probabilidade_sucesso,
          proxima_acao: r.proxima_acao,
          base_legal: r.base_legal,
          analisado_em: r.criado_em,
        })),
      });
    }

    case "consultar_atualizacoes_legais": {
      const { getAtualizacoesLegaisRecentes, formatarAtualizacoesLegaisTexto } =
        await import("./atualizacoes-legais-db");
      const tipoBeneficio =
        typeof input.tipo_beneficio === "string" && input.tipo_beneficio.trim()
          ? [input.tipo_beneficio.trim()]
          : undefined;
      const atualizacoes = await getAtualizacoesLegaisRecentes(tipoBeneficio);
      return JSON.stringify({
        atualizacoes: formatarAtualizacoesLegaisTexto(atualizacoes),
        total: atualizacoes.length,
      });
    }

    case "listar_processos_parados": {
      const { getAllProcessosProducao } = await import("./producao-db");
      const diasMinimo =
        typeof input.dias_minimo === "string" && /^\d+$/.test(input.dias_minimo)
          ? Number(input.dias_minimo)
          : 30;
      const podeVerTodosParados = hasPermission(
        session,
        "processos_ver_todos",
        "ver"
      );
      const colaboradorIdParados = podeVerTodosParados
        ? null
        : await getColaboradorIdForUser(session.id);
      const processos = await getAllProcessosProducao(colaboradorIdParados);
      const parados = processos
        .filter(
          (p) =>
            p.estagio_producao !== "arquivado" &&
            p.dias_no_estagio >= diasMinimo
        )
        .sort((a, b) => b.dias_no_estagio - a.dias_no_estagio);
      return JSON.stringify({
        total: parados.length,
        dias_minimo: diasMinimo,
        processos: parados.map((p) => ({
          cliente: p.client_name,
          numero: p.numero,
          estagio: p.estagio_producao,
          dias_parado: p.dias_no_estagio,
          responsavel: p.responsavel_nome,
        })),
      });
    }

    case "consultar_saude_financeira": {
      const { getLancamentoKpis } = await import("./lancamentos-db");
      const kpis = await getLancamentoKpis();
      const [{ total: valorAtrasado }] = await sql`
        SELECT COALESCE(SUM(valor), 0) AS total
        FROM lancamentos
        WHERE tipo = 'entrada' AND status = 'pendente'
          AND data_vencimento < (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
          AND data_vencimento < '9998-01-01'
      `;
      return JSON.stringify({ ...kpis, valor_atrasado: Number(valorAtrasado) });
    }

    case "listar_clientes_sem_resposta": {
      const { getClientesAguardandoResposta } =
        await import("./prevbot-status");
      const diasMinimo =
        typeof input.dias_minimo === "string" && /^\d+$/.test(input.dias_minimo)
          ? Number(input.dias_minimo)
          : 3;
      const clientes = await getClientesAguardandoResposta(diasMinimo);
      return JSON.stringify({
        total: clientes.length,
        dias_minimo: diasMinimo,
        clientes: clientes.map((c) => ({
          cliente: c.clienteNome,
          dias_sem_resposta: c.diasSemResposta,
        })),
      });
    }

    case "listar_etiquetas": {
      const { getCatalogoEtiquetas } = await import("./etiquetas-db");
      const { formatarEtiqueta } = await import("./etiquetas-types");
      const categoriaFiltro =
        typeof input.categoria === "string"
          ? input.categoria.trim().toUpperCase()
          : "";
      const catalogo = await getCatalogoEtiquetas();
      const filtradas = categoriaFiltro
        ? catalogo.filter((e) => e.categoria === categoriaFiltro)
        : catalogo;
      const porCategoria = new Map<string, string[]>();
      for (const e of filtradas) {
        const arr = porCategoria.get(e.categoria) ?? [];
        arr.push(formatarEtiqueta(e));
        porCategoria.set(e.categoria, arr);
      }
      return JSON.stringify({
        total: filtradas.length,
        por_categoria: Object.fromEntries(porCategoria),
      });
    }

    case "adicionar_etiqueta": {
      const entidadeTipo = String(input.entidade_tipo ?? "")
        .trim()
        .toLowerCase();
      const entidadeBusca = String(input.entidade_busca ?? "").trim();
      const categoriaRaw = String(input.categoria ?? "").trim();
      const valorRaw = String(input.valor ?? "").trim();
      if (!entidadeBusca || !categoriaRaw || !valorRaw) {
        return JSON.stringify({
          ok: false,
          erro: "Informe entidade_busca, categoria e valor.",
        });
      }
      if (entidadeTipo !== "cliente" && entidadeTipo !== "processo") {
        return JSON.stringify({
          ok: false,
          erro: "entidade_tipo precisa ser 'cliente' ou 'processo'.",
        });
      }

      const categoria = categoriaRaw.toUpperCase().replace(/\s+/g, "_");
      const valor = valorRaw.toUpperCase().replace(/\s+/g, "_");

      const {
        getEtiquetaPorCategoriaValor,
        criarOuObterEtiqueta,
        aplicarEtiquetaCliente,
        aplicarEtiquetaProcesso,
      } = await import("./etiquetas-db");

      let etiquetaId: string;
      const existente = await getEtiquetaPorCategoriaValor(categoria, valor);
      if (existente) {
        etiquetaId = existente.id;
      } else if (!hasPermission(session, "configuracoes", "editar")) {
        return JSON.stringify({
          ok: false,
          erro: `A etiqueta "${categoria}:${valor}" ainda não existe no catálogo — só administradores podem criar uma etiqueta nova. Sugira usar "listar_etiquetas" pra ver as que já existem.`,
        });
      } else {
        const nova = await criarOuObterEtiqueta(
          categoria,
          valor,
          "slate",
          "ambos"
        );
        etiquetaId = nova.id;
      }

      if (entidadeTipo === "cliente") {
        if (!hasPermission(session, "clientes", "editar"))
          return JSON.stringify({
            ok: false,
            erro: "Este usuário não tem permissão pra editar clientes.",
          });
        const clientes = await sql`
          SELECT id::text, name FROM clients
          WHERE deleted_at IS NULL AND name ILIKE ${"%" + entidadeBusca + "%"}
          LIMIT 5
        `;
        if (clientes.length === 0)
          return JSON.stringify({
            ok: false,
            erro: `Nenhum cliente encontrado com "${entidadeBusca}".`,
          });
        if (clientes.length > 1)
          return JSON.stringify({
            ok: false,
            erro: `Mais de um cliente encontrado com "${entidadeBusca}" — seja mais específico.`,
            opcoes: clientes.map((c) => c.name),
          });
        if (!(await podeAcessarCliente(session, String(clientes[0].id))))
          return JSON.stringify({
            ok: false,
            erro: "Este usuário não tem acesso a esse cliente. Explique isso educadamente e não tente de novo.",
          });
        await aplicarEtiquetaCliente(etiquetaId, String(clientes[0].id));
        return JSON.stringify({
          ok: true,
          mensagem: `Etiqueta ${categoria}:${valor} aplicada em ${clientes[0].name}.`,
        });
      }

      if (!hasPermission(session, "processos", "editar"))
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem permissão pra editar processos.",
        });
      const podeVerTodos3 = hasPermission(
        session,
        "processos_ver_todos",
        "ver"
      );
      const colaboradorId3 = podeVerTodos3
        ? null
        : await getColaboradorIdForUser(session.id);
      const processos = await sql`
        SELECT p.id::text, p.numero, cl.name AS cliente_nome
        FROM processos p
        LEFT JOIN clients cl ON cl.id = p.client_id
        WHERE p.deleted_at IS NULL
          AND (cl.name ILIKE ${"%" + entidadeBusca + "%"} OR p.numero ILIKE ${"%" + entidadeBusca + "%"})
          AND (${podeVerTodos3} OR p.responsavel_id = ${colaboradorId3}::uuid)
        LIMIT 5
      `;
      if (processos.length === 0)
        return JSON.stringify({
          ok: false,
          erro: `Nenhum processo encontrado com "${entidadeBusca}".`,
        });
      if (processos.length > 1)
        return JSON.stringify({
          ok: false,
          erro: `Mais de um processo encontrado com "${entidadeBusca}" — seja mais específico (use o número CNJ).`,
          opcoes: processos.map(
            (p) => `${p.cliente_nome} — ${p.numero ?? "sem número"}`
          ),
        });
      await aplicarEtiquetaProcesso(etiquetaId, String(processos[0].id));
      return JSON.stringify({
        ok: true,
        mensagem: `Etiqueta ${categoria}:${valor} aplicada no processo de ${processos[0].cliente_nome}.`,
      });
    }

    case "remarcar_pericia": {
      if (!hasPermission(session, "controles", "editar")) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem permissão pra editar controles/perícias. Explique isso educadamente e não tente de novo.",
        });
      }

      const clienteBusca = String(input.cliente_busca ?? "").trim();
      const novaData = String(input.nova_data ?? "").trim();
      if (!clienteBusca || !/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
        return JSON.stringify({
          ok: false,
          erro: "Informe cliente_busca e nova_data no formato YYYY-MM-DD.",
        });
      }
      const novaHora =
        typeof input.nova_hora === "string" &&
        /^\d{2}:\d{2}$/.test(input.nova_hora)
          ? input.nova_hora
          : null;
      const novoLocal =
        typeof input.novo_local === "string" && input.novo_local.trim()
          ? input.novo_local.trim()
          : null;
      const novoProtocolo =
        typeof input.novo_protocolo === "string" && input.novo_protocolo.trim()
          ? input.novo_protocolo.trim()
          : null;
      const tipoPericiaHint = String(input.tipo_pericia ?? "")
        .trim()
        .toLowerCase();
      const tipoMap: Record<string, string> = {
        medica: "pericia_administrativa",
        social: "avaliacao_social_administrativa",
      };

      const candidatas = await sql`
        SELECT p.id::text, p.tipo, p.data_pericia::text, cl.id::text AS cliente_id, cl.name AS cliente_nome
        FROM pericias p
        JOIN clients cl ON cl.id = p.client_id
        WHERE cl.name ILIKE ${"%" + clienteBusca + "%"}
          AND p.status = 'agendado'
        ORDER BY p.data_pericia ASC
      `;
      const filtradas = tipoMap[tipoPericiaHint]
        ? candidatas.filter((c) => c.tipo === tipoMap[tipoPericiaHint])
        : candidatas;

      if (filtradas.length === 0) {
        return JSON.stringify({
          ok: false,
          erro: `Nenhuma perícia agendada encontrada pra "${clienteBusca}"${tipoMap[tipoPericiaHint] ? ` do tipo ${tipoPericiaHint}` : ""}.`,
        });
      }
      if (filtradas.length > 1) {
        return JSON.stringify({
          ok: false,
          erro: `Mais de uma perícia agendada pra "${clienteBusca}" — pergunte ao usuário qual delas (pode usar tipo_pericia: 'medica' ou 'social' pra desambiguar).`,
          opcoes: filtradas.map(
            (c) => `${c.cliente_nome} — ${c.tipo} — ${c.data_pericia}`
          ),
        });
      }

      const periciaId = String(filtradas[0].id);
      const clienteIdRemarcar = String(filtradas[0].cliente_id);
      if (!(await podeAcessarCliente(session, clienteIdRemarcar))) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem acesso a esse cliente. Explique isso educadamente e não tente de novo.",
        });
      }
      await sql`
        UPDATE pericias SET
          data_pericia = ${novaData}::date,
          hora_pericia = COALESCE(${novaHora}::time, hora_pericia),
          local_pericia = COALESCE(${novoLocal}, local_pericia),
          observacoes = COALESCE(${novoProtocolo ? `Protocolo INSS: ${novoProtocolo}` : null}, observacoes),
          updated_at = NOW()
        WHERE id = ${periciaId}::uuid
      `;

      const { sincronizarCompromissoDaPericia } =
        await import("./pericia-agenda-sync");
      const resultado = await sincronizarCompromissoDaPericia(periciaId);

      return JSON.stringify({
        ok: true,
        mensagem: `Perícia de ${filtradas[0].cliente_nome} remarcada para ${novaData}${novaHora ? ` às ${novaHora}` : ""}.`,
        agenda_sincronizada: resultado.sincronizado,
        aviso_enviado_ao_cliente: resultado.avisoEnviado,
        observacao: resultado.sincronizado
          ? undefined
          : "Essa perícia não tem um compromisso vinculado na Agenda (perícia antiga, criada antes desse vínculo existir) — a data foi atualizada só em Perícias, sem sincronizar a Agenda nem avisar o cliente automaticamente. Avise o usuário disso.",
        cliente_id: String(filtradas[0].cliente_id),
      });
    }

    case "agendar_pericia": {
      if (!hasPermission(session, "controles", "criar")) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem permissão pra criar controles/perícias. Explique isso educadamente e não tente de novo.",
        });
      }

      const clienteBusca = String(input.cliente_busca ?? "").trim();
      const tipoHint = String(input.tipo_pericia ?? "")
        .trim()
        .toLowerCase();
      const data = String(input.data ?? "").trim();
      if (!clienteBusca || !tipoHint || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return JSON.stringify({
          ok: false,
          erro: "Informe cliente_busca, tipo_pericia ('medica' ou 'social') e data no formato YYYY-MM-DD.",
        });
      }
      const tipoMap: Record<string, string> = {
        medica: "pericia_administrativa",
        social: "avaliacao_social_administrativa",
      };
      const tipoPericia = tipoMap[tipoHint];
      if (!tipoPericia) {
        return JSON.stringify({
          ok: false,
          erro: "tipo_pericia precisa ser 'medica' ou 'social'.",
        });
      }
      const hora =
        typeof input.hora === "string" && /^\d{2}:\d{2}$/.test(input.hora)
          ? input.hora
          : "09:00";
      const local =
        typeof input.local === "string" && input.local.trim()
          ? input.local.trim()
          : "A definir";
      const protocolo =
        typeof input.protocolo === "string" && input.protocolo.trim()
          ? input.protocolo.trim()
          : null;
      const descricaoLabel: Record<string, string> = {
        medica: "Perícia Médica",
        social: "Avaliação Social BPC/LOAS",
      };
      const tipoServico =
        typeof input.descricao_servico === "string" &&
        input.descricao_servico.trim()
          ? input.descricao_servico.trim().slice(0, 200)
          : descricaoLabel[tipoHint];

      const candidatosCliente = await sql`
        SELECT id::text, name FROM clients
        WHERE deleted_at IS NULL AND name ILIKE ${"%" + clienteBusca + "%"}
        LIMIT 5
      `;
      if (candidatosCliente.length === 0) {
        return JSON.stringify({
          ok: false,
          erro: `Nenhum cliente encontrado com "${clienteBusca}". Se for cliente novo, use cadastrar_cliente antes.`,
        });
      }
      if (candidatosCliente.length > 1) {
        return JSON.stringify({
          ok: false,
          erro: `Mais de um cliente encontrado com "${clienteBusca}" — pergunte ao usuário qual, ou seja mais específico.`,
          opcoes: candidatosCliente.map((c) => c.name),
        });
      }
      if (
        !(await podeAcessarCliente(session, String(candidatosCliente[0].id)))
      ) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem acesso a esse cliente. Explique isso educadamente e não tente de novo.",
        });
      }

      const { criarNovoAgendamentoPericia } =
        await import("./pericia-novo-agendamento");
      type ResultadoAgendamento = Awaited<
        ReturnType<typeof criarNovoAgendamentoPericia>
      >;
      const resultado: ResultadoAgendamento = await criarNovoAgendamentoPericia(
        {
          clienteId: String(candidatosCliente[0].id),
          tipoPericia: tipoPericia as
            | "avaliacao_social_administrativa"
            | "pericia_administrativa",
          tipoServico,
          data,
          hora,
          local,
          protocolo,
          criadoPorLogin: session.login,
          criadoPorUserId: session.id,
        }
      ).catch((e): ResultadoAgendamento => {
        console.error("[iris-tools] falha ao agendar pericia:", e);
        return { ok: false, erro: "Erro ao salvar o agendamento." };
      });

      if (!resultado.ok) {
        return JSON.stringify(resultado);
      }

      return JSON.stringify({
        ok: true,
        mensagem: `${descricaoLabel[tipoHint]} agendada pra ${resultado.clienteNome} em ${data}${hora ? ` às ${hora}` : ""}. Já criei o compromisso na Agenda, o prazo em Controles e programei os lembretes automáticos.`,
        aviso_enviado_ao_cliente: resultado.avisoEnviado,
        compromisso_id: resultado.compromissoId,
        cliente_id: String(candidatosCliente[0].id),
      });
    }

    case "criar_controle_pericia": {
      if (!hasPermission(session, "controles", "criar")) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem permissão pra criar controles/perícias. Explique isso educadamente e não tente de novo.",
        });
      }

      const clienteBusca = String(input.cliente_busca ?? "").trim();
      const tipo = String(input.tipo ?? "").trim();
      const data = String(input.data ?? "").trim();
      const TIPOS_VALIDOS = new Set([
        "pericia_administrativa",
        "pericia_judicial",
        "avaliacao_social_administrativa",
        "avaliacao_social_judicial",
        "prorrogacao_beneficio",
      ]);
      if (
        !clienteBusca ||
        !TIPOS_VALIDOS.has(tipo) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data)
      ) {
        return JSON.stringify({
          ok: false,
          erro: "Informe cliente_busca, tipo (um de: pericia_administrativa, pericia_judicial, avaliacao_social_administrativa, avaliacao_social_judicial, prorrogacao_beneficio) e data no formato YYYY-MM-DD.",
        });
      }

      const candidatosCliente2 = await sql`
        SELECT id::text, name FROM clients
        WHERE deleted_at IS NULL AND name ILIKE ${"%" + clienteBusca + "%"}
        LIMIT 5
      `;
      if (candidatosCliente2.length === 0) {
        return JSON.stringify({
          ok: false,
          erro: `Nenhum cliente encontrado com "${clienteBusca}". Se for cliente novo, use cadastrar_cliente antes.`,
        });
      }
      if (candidatosCliente2.length > 1) {
        return JSON.stringify({
          ok: false,
          erro: `Mais de um cliente encontrado com "${clienteBusca}" — pergunte ao usuário qual, ou seja mais específico.`,
          opcoes: candidatosCliente2.map((c) => c.name),
        });
      }
      if (
        !(await podeAcessarCliente(session, String(candidatosCliente2[0].id)))
      ) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem acesso a esse cliente. Explique isso educadamente e não tente de novo.",
        });
      }

      const hora =
        typeof input.hora === "string" && /^\d{2}:\d{2}$/.test(input.hora)
          ? input.hora
          : null;
      const strOrNullCP = (v: unknown) =>
        typeof v === "string" && v.trim() ? v.trim() : null;
      const dataOrNullCP = (v: unknown) =>
        typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())
          ? v.trim()
          : null;
      const local = strOrNullCP(input.local);
      const perito = strOrNullCP(input.perito);
      const especialidade = strOrNullCP(input.especialidade);
      const status =
        typeof input.status === "string" &&
        ["agendado", "realizado", "remarcado", "cancelado"].includes(
          input.status.trim()
        )
          ? input.status.trim()
          : "agendado";
      const beneficioNumero = strOrNullCP(input.beneficio_numero);
      const beneficioTipo = strOrNullCP(input.beneficio_tipo);
      const dataFimBeneficio = dataOrNullCP(input.data_fim_beneficio);
      const novaDataFim = dataOrNullCP(input.nova_data_fim);
      const observacoes = strOrNullCP(input.observacoes);

      // Prorrogação de benefício é prazo interno (o escritório precisa agir
      // antes do INSS cessar o benefício), não um compromisso do cliente —
      // diferente das perícias/avaliações judiciais, aqui dá pra saber com
      // certeza que quem precisa ser avisado é sempre o escritório. Cria
      // compromisso na Agenda (senão o registro fica só em Controles →
      // Perícias, invisível na Agenda de verdade) e agenda lembrete
      // automático por WhatsApp perto da data, mesmo padrão já usado pras
      // perícias do INSS (agendarLembretesCompromissoPrevBot).
      const clienteNome2 = candidatosCliente2[0].name as string;
      const clienteId2 = candidatosCliente2[0].id as string;

      let novaPericiaId: string;
      let compromissoIdProrrogacao: string | null = null;
      try {
        if (tipo === "prorrogacao_beneficio") {
          const tituloComp = `Prorrogação de benefício — ${clienteNome2}`;
          const [compromisso] = await sql`
            INSERT INTO compromissos
              (titulo, tipo, data_inicio, criado_por, cliente_id, descricao)
            VALUES
              (${tituloComp}, 'outro', ${data}::date, ${session.login},
               ${clienteId2}::uuid, ${observacoes})
            RETURNING id::text
          `;
          compromissoIdProrrogacao = String(compromisso.id);
        }

        const rows = await sql`
          INSERT INTO pericias (
            tipo, client_id, data_pericia, hora_pericia,
            local_pericia, perito, especialidade, status,
            beneficio_numero, beneficio_tipo,
            data_fim_beneficio, nova_data_fim, observacoes, compromisso_id
          ) VALUES (
            ${tipo}, ${clienteId2}::uuid, ${data}::date, ${hora}::time,
            ${local}, ${perito}, ${especialidade}, ${status},
            ${beneficioNumero}, ${beneficioTipo},
            ${dataFimBeneficio}::date, ${novaDataFim}::date, ${observacoes},
            ${compromissoIdProrrogacao}::uuid
          )
          RETURNING id::text
        `;
        novaPericiaId = String(rows[0].id);
      } catch (e) {
        console.error("[iris-tools] falha ao criar controle de pericia:", e);
        return JSON.stringify({
          ok: false,
          erro: "Erro ao salvar o controle no banco de dados.",
        });
      }

      let lembreteAgendado = false;
      if (compromissoIdProrrogacao) {
        try {
          const [escritorio] =
            await sql`SELECT nome, telefone FROM escritorio_config LIMIT 1`;
          const telefoneEscritorio = String(escritorio?.telefone ?? "").trim();
          if (telefoneEscritorio) {
            const { agendarLembretesCompromissoPrevBot } =
              await import("./lembretes");
            await agendarLembretesCompromissoPrevBot({
              compromissoId: compromissoIdProrrogacao,
              titulo: `Prorrogação de benefício — ${clienteNome2}`,
              dataEvento: new Date(data + "T12:00:00"),
              hora: null,
              local: null,
              colaboradorTelefone: telefoneEscritorio,
              colaboradorNome: String(escritorio?.nome ?? "Escritório"),
              clienteNome: clienteNome2,
            });
            lembreteAgendado = true;
          }
        } catch (e) {
          console.error(
            "[iris-tools] falha ao agendar lembrete de prorrogação:",
            e
          );
        }
      }

      return JSON.stringify({
        ok: true,
        mensagem:
          tipo === "prorrogacao_beneficio"
            ? `Controle de prorrogação criado pra ${clienteNome2}, data ${data}. Já apareceu na Agenda${lembreteAgendado ? " e programei lembrete automático por WhatsApp pro escritório perto da data" : " (não consegui programar o lembrete automático — confirme o telefone do escritório em Configurações)"}.`
            : `Controle criado pra ${clienteNome2} (${tipo}), data ${data}. Isto fica em Controles → Perícias — não cria compromisso na Agenda nem lembrete automático por WhatsApp, é só o registro/prazo.`,
        pericia_id: novaPericiaId,
        cliente_id: clienteId2,
      });
    }

    case "cadastrar_cliente": {
      if (!hasPermission(session, "clientes", "criar")) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem permissão pra cadastrar clientes. Explique isso educadamente e não tente de novo.",
        });
      }

      const tipo = String(input.tipo ?? "")
        .trim()
        .toUpperCase();
      const nome = String(input.name ?? "").trim();
      const docBruto = String(input.doc ?? "").trim();
      if (!["PF", "PJ"].includes(tipo) || !nome || !docBruto) {
        return JSON.stringify({
          ok: false,
          erro: "Informe tipo ('PF' ou 'PJ'), name e doc.",
        });
      }
      const docDigits = docBruto.replace(/\D/g, "");
      if (!docDigits) {
        return JSON.stringify({
          ok: false,
          erro: "Documento (CPF/CNPJ) inválido.",
        });
      }

      const menorIncapaz = String(input.menor_incapaz ?? "").trim() === "true";
      const responsavelNome =
        String(input.responsavel_nome ?? "").trim() || null;
      const responsavelTelefone =
        String(input.responsavel_telefone ?? "").trim() || null;
      if (menorIncapaz && (!responsavelNome || !responsavelTelefone)) {
        return JSON.stringify({
          ok: false,
          erro: "Cliente marcado como menor/incapaz precisa de responsavel_nome e responsavel_telefone — é pra esse telefone que os avisos automáticos vão.",
        });
      }
      const responsavelParentesco =
        String(input.responsavel_parentesco ?? "").trim() || null;
      const responsavelCpf = String(input.responsavel_cpf ?? "").trim() || null;
      const responsavelRg = String(input.responsavel_rg ?? "").trim() || null;
      const responsavelRgOrgao =
        String(input.responsavel_rg_orgao ?? "").trim() || null;
      const responsavelEmail =
        String(input.responsavel_email ?? "").trim() || null;

      const email = String(input.email ?? "").trim() || null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return JSON.stringify({ ok: false, erro: "E-mail inválido." });
      }
      const phone = String(input.phone ?? "").trim() || null;
      const city = String(input.city ?? "").trim() || "—";
      const state =
        String(input.state ?? "")
          .trim()
          .toUpperCase() || "SP";
      const notes = String(input.notes ?? "").trim() || null;

      // Dados previdenciários/pessoais que já costumam vir junto no mesmo
      // documento que originou o cadastro (ex: comunicação de decisão do
      // INSS) — gravados direto aqui em vez de depender de uma segunda
      // chamada a complementar_cliente, que a Íris às vezes pula mesmo
      // tendo o dado em mãos (achava que "cadastrar" já bastava e citava
      // esses campos na resposta sem eles terem sido salvos de verdade).
      const strOrNullCC = (v: unknown) =>
        typeof v === "string" && v.trim() ? v.trim() : null;
      const dataOrNullCC = (v: unknown) =>
        typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())
          ? v.trim()
          : null;
      const numOrNullCC = (v: unknown) => {
        if (typeof v !== "string" || !v.trim()) return null;
        const n = Number(v.trim().replace(",", "."));
        return Number.isFinite(n) ? n : null;
      };
      const intOrNullCC = (v: unknown) => {
        if (typeof v !== "string" || !v.trim()) return null;
        const n = Number.parseInt(v.trim(), 10);
        return Number.isFinite(n) ? n : null;
      };
      const rg = strOrNullCC(input.rg);
      const rgOrgao = strOrNullCC(input.rg_orgao);
      const birthDate = dataOrNullCC(input.birth_date);
      const genero = strOrNullCC(input.genero);
      const filiacaoMae = strOrNullCC(input.filiacao_mae);
      const filiacaoPai = strOrNullCC(input.filiacao_pai);
      const naturalidadeCidade = strOrNullCC(input.naturalidade_cidade);
      const naturalidadeEstado = strOrNullCC(input.naturalidade_estado);
      const nis = strOrNullCC(input.nis);
      const numBeneficio = strOrNullCC(input.num_beneficio);
      const tipoBeneficio = strOrNullCC(input.tipo_beneficio);
      const statusBeneficio = strOrNullCC(input.status_beneficio);
      const dataInicioBeneficio = dataOrNullCC(input.data_inicio_beneficio);
      const valorBeneficio = numOrNullCC(input.valor_beneficio);
      const cidPrincipal = strOrNullCC(input.cid_principal);
      const tipoIncapacidade = strOrNullCC(input.tipo_incapacidade);
      const dataDiagnostico = dataOrNullCC(input.data_diagnostico);
      const dataAfastamento = dataOrNullCC(input.data_afastamento);
      const categoriaContribuinte = strOrNullCC(input.categoria_contribuinte);
      const numContribuicoes = intOrNullCC(input.num_contribuicoes);

      // Evita duplicar cliente já cadastrado com o mesmo CPF/CNPJ.
      const existentes = await sql`
        SELECT id::text, name FROM clients
        WHERE deleted_at IS NULL AND regexp_replace(doc, '\D', '', 'g') = ${docDigits}
        LIMIT 1
      `;
      if (existentes.length > 0) {
        return JSON.stringify({
          ok: false,
          erro: `Já existe um cliente cadastrado com esse documento: ${existentes[0].name}. Não crie duplicado — se for atualização de dados, isso precisa ser feito na tela do cliente.`,
        });
      }
      if (email) {
        const dupEmail =
          await sql`SELECT id FROM clients WHERE email = ${email} AND deleted_at IS NULL LIMIT 1`;
        if (dupEmail.length > 0) {
          return JSON.stringify({
            ok: false,
            erro: "Esse e-mail já está cadastrado em outro cliente.",
          });
        }
      }

      // clients.email e clients.phone são NOT NULL no banco (sem default) —
      // passar null (em vez de string vazia) quando não informado derrubava
      // o INSERT inteiro com "violates not-null constraint", e a Íris só via
      // um erro genérico, sem conseguir dizer a causa real pro usuário. O
      // formulário manual de cadastro nunca bate nisso porque sempre lê o
      // campo do form como string (vazia, não null).
      let novoId: string;
      try {
        const rows = await sql`
          INSERT INTO clients
            (type, name, doc, email, phone, notes,
             cep, street, addr_number, neighborhood, city, state,
             menor_incapaz, responsavel_nome, responsavel_telefone, responsavel_parentesco,
             responsavel_cpf, responsavel_rg, responsavel_rg_orgao, responsavel_email,
             rg, rg_orgao, birth_date, genero, filiacao_mae, filiacao_pai,
             naturalidade_cidade, naturalidade_estado,
             nis, num_beneficio, tipo_beneficio, status_beneficio, data_inicio_beneficio,
             valor_beneficio, cid_principal, tipo_incapacidade, data_diagnostico,
             data_afastamento, categoria_contribuinte, num_contribuicoes)
          VALUES
            (${tipo}, ${nome}, ${docBruto}, ${email ?? ""}, ${phone ?? ""}, ${notes},
             '00000-000', '—', 'S/N', '—', ${city}, ${state},
             ${menorIncapaz}, ${responsavelNome}, ${responsavelTelefone}, ${responsavelParentesco},
             ${responsavelCpf}, ${responsavelRg}, ${responsavelRgOrgao}, ${responsavelEmail},
             ${rg}, ${rgOrgao}, ${birthDate}::date, ${genero}, ${filiacaoMae}, ${filiacaoPai},
             ${naturalidadeCidade}, ${naturalidadeEstado},
             ${nis}, ${numBeneficio}, ${tipoBeneficio}, ${statusBeneficio}, ${dataInicioBeneficio}::date,
             ${valorBeneficio}, ${cidPrincipal}, ${tipoIncapacidade}, ${dataDiagnostico}::date,
             ${dataAfastamento}::date, ${categoriaContribuinte}, ${numContribuicoes})
          RETURNING id::text
        `;
        novoId = String(rows[0].id);
      } catch (err) {
        console.error("[iris-tools] falha ao cadastrar cliente:", err);
        return JSON.stringify({
          ok: false,
          erro: "Erro ao salvar o cliente no banco de dados.",
        });
      }

      return JSON.stringify({
        ok: true,
        mensagem: `Cliente ${nome} cadastrado com sucesso (${tipo}).`,
        cliente_id: novoId,
        observacao:
          "Endereço completo ficou com placeholder — peça pra alguém completar isso na tela do cliente quando tiver os dados.",
      });
    }

    case "complementar_cliente": {
      if (!hasPermission(session, "clientes", "editar")) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem permissão pra editar clientes. Explique isso educadamente e não tente de novo.",
        });
      }

      const clienteBusca = String(input.cliente_busca ?? "").trim();
      if (!clienteBusca) {
        return JSON.stringify({ ok: false, erro: "Informe cliente_busca." });
      }

      const candidatos = await sql`
        SELECT id::text, name FROM clients
        WHERE deleted_at IS NULL AND name ILIKE ${"%" + clienteBusca + "%"}
        LIMIT 5
      `;
      if (candidatos.length === 0) {
        return JSON.stringify({
          ok: false,
          erro: `Nenhum cliente encontrado com "${clienteBusca}". Se for pra cadastrar um cliente novo, use cadastrar_cliente em vez disso.`,
        });
      }
      if (candidatos.length > 1) {
        return JSON.stringify({
          ok: false,
          erro: `Mais de um cliente encontrado com "${clienteBusca}" — pergunte ao usuário qual, ou seja mais específico.`,
          opcoes: candidatos.map((c) => c.name),
        });
      }
      if (!(await podeAcessarCliente(session, String(candidatos[0].id)))) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem acesso a esse cliente. Explique isso educadamente e não tente de novo.",
        });
      }

      const CAMPOS_TEXTO = [
        "doc",
        "rg",
        "rg_orgao",
        "birth_date",
        "genero",
        "filiacao_mae",
        "filiacao_pai",
        "cep",
        "street",
        "addr_number",
        "complement",
        "neighborhood",
        "city",
        "state",
        "phone",
        "email",
        "nis",
        "num_beneficio",
        "tipo_beneficio",
        "cid_principal",
        "tipo_incapacidade",
        "data_afastamento",
        "naturalidade_cidade",
        "naturalidade_estado",
        "status_beneficio",
        "data_inicio_beneficio",
        "valor_beneficio",
        "categoria_contribuinte",
        "data_diagnostico",
        "num_contribuicoes",
        "responsavel_nome",
        "responsavel_telefone",
        "responsavel_parentesco",
        "responsavel_cpf",
        "responsavel_rg",
        "responsavel_rg_orgao",
        "responsavel_email",
      ] as const;

      const dados: Record<string, string> = {};
      for (const campo of CAMPOS_TEXTO) {
        const valor = String(input[campo] ?? "").trim();
        if (valor) dados[campo] = valor;
      }
      if (Object.keys(dados).length === 0) {
        return JSON.stringify({
          ok: false,
          erro: "Nenhum dado novo informado pra preencher.",
        });
      }

      const { aplicarCamposClienteSeVazios } =
        await import("./cliente-documento-auto");
      const preenchidos = await aplicarCamposClienteSeVazios(
        String(candidatos[0].id),
        dados,
        "informado pela Íris no chat"
      ).catch((e) => {
        console.error("[iris-tools] falha ao complementar cliente:", e);
        return [] as string[];
      });

      if (preenchidos.length === 0) {
        return JSON.stringify({
          ok: true,
          mensagem: `Nenhum campo novo pra preencher em ${candidatos[0].name} — os dados informados já estavam cadastrados (não sobrescrevo dado existente).`,
          campos_preenchidos: [],
          cliente_id: String(candidatos[0].id),
        });
      }

      return JSON.stringify({
        ok: true,
        mensagem: `Cadastro de ${candidatos[0].name} atualizado: ${preenchidos.join(", ")}.`,
        campos_preenchidos: preenchidos,
        cliente_id: String(candidatos[0].id),
      });
    }

    case "criar_controle": {
      if (!hasPermission(session, "controles", "criar")) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem permissão pra criar controles. Explique isso educadamente e não tente de novo.",
        });
      }

      const TIPOS_VALIDOS_CTRL = new Set([
        "audiencias",
        "prazos",
        "dcb",
        "beneficios",
        "implantados",
        "implantados-data",
        "alvaras",
      ]);
      const tipo = String(input.tipo ?? "").trim();
      const clienteBusca = String(input.cliente_busca ?? "").trim();
      if (!TIPOS_VALIDOS_CTRL.has(tipo) || !clienteBusca) {
        return JSON.stringify({
          ok: false,
          erro: "Informe tipo (audiencias, prazos, dcb, beneficios, implantados, implantados-data, alvaras) e cliente_busca.",
        });
      }

      const candidatosCliente3 = await sql`
        SELECT id::text, name FROM clients
        WHERE deleted_at IS NULL AND name ILIKE ${"%" + clienteBusca + "%"}
        LIMIT 5
      `;
      if (candidatosCliente3.length === 0) {
        return JSON.stringify({
          ok: false,
          erro: `Nenhum cliente encontrado com "${clienteBusca}". Se for cliente novo, use cadastrar_cliente antes.`,
        });
      }
      if (candidatosCliente3.length > 1) {
        return JSON.stringify({
          ok: false,
          erro: `Mais de um cliente encontrado com "${clienteBusca}" — pergunte ao usuário qual, ou seja mais específico.`,
          opcoes: candidatosCliente3.map((c) => c.name),
        });
      }
      const clienteId3 = String(candidatosCliente3[0].id);
      const clienteNome3 = String(candidatosCliente3[0].name);
      if (!(await podeAcessarCliente(session, clienteId3))) {
        return JSON.stringify({
          ok: false,
          erro: "Este usuário não tem acesso a esse cliente. Explique isso educadamente e não tente de novo.",
        });
      }

      let processoId3: string | null = null;
      const processoBusca = String(input.processo_busca ?? "").trim();
      if (processoBusca) {
        const candidatosProcesso = await sql`
          SELECT id::text, numero FROM processos
          WHERE client_id = ${clienteId3}::uuid AND deleted_at IS NULL
            AND numero ILIKE ${"%" + processoBusca + "%"}
          LIMIT 5
        `;
        if (candidatosProcesso.length === 1) {
          processoId3 = String(candidatosProcesso[0].id);
        } else if (candidatosProcesso.length > 1) {
          return JSON.stringify({
            ok: false,
            erro: `Mais de um processo de ${clienteNome3} bate com "${processoBusca}" — seja mais específico.`,
            opcoes: candidatosProcesso.map((p) => p.numero),
          });
        }
        // 0 encontrados: segue sem processo_id, não bloqueia o controle
      }

      const strOrNullCtrl = (v: unknown) =>
        typeof v === "string" && v.trim() ? v.trim() : null;
      const dataOrNullCtrl = (v: unknown) =>
        typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())
          ? v.trim()
          : null;

      const dataEvento = dataOrNullCtrl(input.data_evento);
      const descricaoInput = strOrNullCtrl(input.descricao);
      const prazoInterno = dataOrNullCtrl(input.prazo_interno);
      const prioridade = ["baixa", "media", "alta"].includes(
        String(input.prioridade ?? "").trim()
      )
        ? String(input.prioridade).trim()
        : "media";
      const fatal = String(input.fatal ?? "").trim() === "true";
      const observacoes = strOrNullCtrl(input.observacoes);
      const tipoDemanda = strOrNullCtrl(input.tipo_demanda);

      const DESCRICAO_OPCIONAL = new Set([
        "audiencias",
        "dcb",
        "implantados-data",
      ]);
      if (tipo !== "implantados-data" && !dataEvento) {
        return JSON.stringify({
          ok: false,
          erro: "Informe data_evento no formato YYYY-MM-DD.",
        });
      }
      if (!DESCRICAO_OPCIONAL.has(tipo) && !descricaoInput) {
        return JSON.stringify({
          ok: false,
          erro: `Descrição é obrigatória pra tipo "${tipo}".`,
        });
      }

      // Sem isso, pedir a mesma coisa duas vezes (ou a Íris tentar de novo
      // depois de um "não tenho certeza se já fiz") criava controle
      // repetido — já aconteceu de verdade com prorrogação de benefício,
      // gerando 2-3 lembretes de WhatsApp iguais pra cada data.
      if (tipo !== "implantados-data" && dataEvento) {
        const duplicata = await sql`
          SELECT id FROM controles
          WHERE cliente_id = ${clienteId3}::uuid AND tipo = ${tipo}
            AND data_evento = ${dataEvento}::date
            AND (status IS NULL OR status != 'cancelado')
          LIMIT 1
        `;
        if (duplicata.length > 0) {
          return JSON.stringify({
            ok: false,
            erro: `Já existe um controle "${getTipoConfig(tipo).label}" pra ${clienteNome3} nessa data (${dataEvento}). Não crie duplicado — se for outra informação, atualize o controle existente pela tela.`,
            duplicataDetectada: true,
          });
        }
      }

      let dadosJson: string | null = null;
      if (tipo === "audiencias") {
        const hora = strOrNullCtrl(input.hora);
        const localTitulo = strOrNullCtrl(input.local_titulo);
        const dados = {
          hora,
          link_virtual: null,
          local_id: null,
          local_titulo: localTitulo,
        };
        dadosJson = Object.values(dados).some((v) => v !== null)
          ? JSON.stringify(dados)
          : null;
      }

      let novoId: string;
      let implantadosCascataId: string | null = null;
      let dcbCascataId: string | null = null;
      let dcbCascataData: string | null = null;
      try {
        if (tipo === "implantados-data") {
          const data1pag = dataOrNullCtrl(input.data_1pag);
          const dataCessacao = dataOrNullCtrl(input.data_cessacao);
          if (!data1pag && !dataCessacao) {
            return JSON.stringify({
              ok: false,
              erro: "Informe data_1pag e/ou data_cessacao.",
            });
          }

          // Mesma cascata da tela manual: informar data de 1° pagamento e/ou
          // de cessação cria automaticamente os controles vinculados
          // 'implantados' e 'dcb' (15 dias antes da cessação) — sem isso, o
          // prazo de prorrogação mais crítico do escritório ficava sem
          // nenhum rastro quando criado pela Íris.
          if (data1pag) {
            const rows = await sql`
              INSERT INTO controles (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, tipo_demanda)
              VALUES ('implantados', ${data1pag}::date,
                      ${descricaoInput || "Benefício implantado (1° Pagamento)"},
                      ${clienteId3}::uuid, ${processoId3}::uuid, ${session.id}::uuid, ${tipoDemanda})
              RETURNING id::text
            `;
            implantadosCascataId = String(rows[0].id);
          }
          if (dataCessacao) {
            const dDcb = new Date(dataCessacao + "T12:00:00");
            dDcb.setDate(dDcb.getDate() - 15);
            const dcbData = dDcb.toISOString().slice(0, 10);
            const rows = await sql`
              INSERT INTO controles (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, tipo_demanda)
              VALUES ('dcb', ${dcbData}::date,
                      ${descricaoInput || "DCB — Prorrogação automática"},
                      ${clienteId3}::uuid, ${processoId3}::uuid, ${session.id}::uuid, ${tipoDemanda})
              RETURNING id::text
            `;
            dcbCascataId = String(rows[0].id);
            dcbCascataData = dcbData;
          }

          const dados = {
            data_1pag: data1pag,
            data_cessacao: dataCessacao,
            implantados_id: implantadosCascataId,
            dcb_id: dcbCascataId,
          };
          dadosJson = JSON.stringify(dados);

          const rows = await sql`
            INSERT INTO controles (tipo, data_evento, prazo_interno, descricao, prioridade, fatal, cliente_id, processo_id, responsavel_id, tipo_demanda, observacoes, dados)
            VALUES ('implantados-data', ${data1pag ?? dataCessacao}::date, ${prazoInterno}::date,
                    ${descricaoInput ?? ""}, ${prioridade}, ${fatal},
                    ${clienteId3}::uuid, ${processoId3}::uuid, ${session.id}::uuid, ${tipoDemanda}, ${observacoes}, ${dadosJson}::jsonb)
            RETURNING id::text
          `;
          novoId = String(rows[0].id);
        } else {
          const rows = await sql`
            INSERT INTO controles (tipo, data_evento, prazo_interno, descricao, prioridade, fatal, cliente_id, processo_id, responsavel_id, tipo_demanda, observacoes, dados)
            VALUES (${tipo}, ${dataEvento}::date, ${prazoInterno}::date,
                    ${descricaoInput ?? ""}, ${prioridade}, ${fatal},
                    ${clienteId3}::uuid, ${processoId3}::uuid, ${session.id}::uuid, ${tipoDemanda}, ${observacoes}, ${dadosJson}::jsonb)
            RETURNING id::text
          `;
          novoId = String(rows[0].id);
        }
      } catch (e) {
        console.error("[iris-tools] falha ao criar controle:", e);
        return JSON.stringify({
          ok: false,
          erro: "Erro ao salvar o controle no banco de dados.",
        });
      }

      if (fatal) {
        try {
          const { alertarPrazoFatalNovo } = await import("./resumo-diario");
          await alertarPrazoFatalNovo(
            descricaoInput ?? getTipoConfig(tipo).label,
            dataEvento ?? input.data_cessacao ?? null,
            clienteNome3
          );
        } catch (e) {
          console.error("[iris-tools] falha ao alertar prazo fatal:", e);
        }
      }

      // DCB é o prazo mais crítico do fluxo de benefício (não a Agenda nem
      // lembrete, sem isso o cliente pode perder o benefício por prazo
      // perdido) — cria compromisso + lembrete tanto pro DCB criado direto
      // quanto pro DCB criado em cascata a partir de implantados-data.
      let lembreteDcbAgendado = false;
      if (tipo === "dcb" && dataEvento) {
        lembreteDcbAgendado = await criarCompromissoLembreteDcb({
          controleId: novoId,
          clienteId: clienteId3,
          clienteNome: clienteNome3,
          data: dataEvento,
          criadoPorLogin: session.login,
        });
      } else if (
        tipo === "implantados-data" &&
        dcbCascataId &&
        dcbCascataData
      ) {
        lembreteDcbAgendado = await criarCompromissoLembreteDcb({
          controleId: dcbCascataId,
          clienteId: clienteId3,
          clienteNome: clienteNome3,
          data: dcbCascataData,
          criadoPorLogin: session.login,
        });
      }

      const cascataMsg =
        tipo === "implantados-data"
          ? ` Também criei automaticamente: ${[
              implantadosCascataId ? "Benefício Implantado (1° Pag.)" : null,
              dcbCascataId
                ? `DCB (15 dias antes da cessação${lembreteDcbAgendado ? ", com lembrete automático agendado" : ""})`
                : null,
            ]
              .filter(Boolean)
              .join(" e ")}.`
          : "";
      const dcbMsg =
        tipo === "dcb"
          ? lembreteDcbAgendado
            ? " Já apareceu na Agenda e programei lembrete automático por WhatsApp pro escritório perto da data."
            : " Não consegui programar o lembrete automático — confirme o telefone do escritório em Configurações."
          : "";

      return JSON.stringify({
        ok: true,
        mensagem: `Controle "${getTipoConfig(tipo).label}" criado pra ${clienteNome3}${processoId3 ? " (processo vinculado)" : ""}.${cascataMsg}${dcbMsg}`,
        controle_id: novoId,
        cliente_id: clienteId3,
      });
    }

    default:
      return JSON.stringify({ erro: `Ferramenta "${name}" não reconhecida` });
  }
}
