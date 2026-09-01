/**
 * Documentação completa do sistema LiderAdv, embutida no prompt da Íris —
 * única IA do sistema (não existe mais assistente separado por tela).
 * REGRA ABSOLUTA pra quem consome isto: responder telas/campos/botões
 * SOMENTE com base no que está aqui — nunca inventar.
 */
export const LIDERADV_DOCS = `━━━━━━━━━━━━━━━━━━━━━━━━
MENU LATERAL — ITENS EXATOS
━━━━━━━━━━━━━━━━━━━━━━━━
Grupo Jurídico: Agenda · Clientes · Processos · Publicações · Controles (inclui aba Perícias) · Leis & DOU
Grupo Negócios: CRM · Produção · Financeiro
Grupo Documentos: Modelos · Assinaturas · PDFs
Grupo Equipe: Minhas Tarefas · Meu Financeiro · Colaboradores · Teste DISC
Grupo Sistema: Gerenciador · Controladoria · Auditoria · Relatórios · Integrações · Usuários · Configurações

━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULOS DO SISTEMA
━━━━━━━━━━━━━━━━━━━━━━━━

## DASHBOARD (início)
- Página inicial com saudação + data
- Ações rápidas: "Novo cliente", "Novo processo", "Novo lead", "Financeiro", "Gerenciador"
- Mostra: alertas previdenciários (DCB próxima), KPI cards, aniversariantes, funil CRM, próximos prazos, resumo financeiro, gráfico receitas×despesas, clientes em débito, e-mails recentes, lançamentos vencidos, mini-calendário com prazos/controles (pontinho âmbar) e compromissos (pontinho azul)
- Banner de tarefas pendentes atribuídas ao usuário

## CLIENTES (menu: Jurídico → Clientes)
- Lista de todos os clientes com filtros e busca
- Botão "Novo Cliente" → abre formulário com 5 etapas (para PF) / 3 etapas (para PJ)

### Cadastrar cliente — etapas:
1. Dados principais: tipo PF/PJ, nome, CPF/CNPJ, telefone, e-mail (CNPJ preenche dados automaticamente)
2. Dados complementares (PF): RG, data de nascimento, estado civil, gênero, profissão, nacionalidade
3. Dados previdenciários (PF): NIS/PIS/PASEP, número do benefício INSS, status, tipo (B32/B41/B42 etc.), valor, carência, naturalidade, nome dos pais, dados de saúde/CID/incapacidade
4. Acesso e parceria: senha, origem (Escritório, Rede Social, Indicação, Tráfego Pago, Outros), se "Indicação" configura comissão ao indicador
5. Endereço: CEP (preenche automaticamente via ViaCEP), logradouro, número, complemento, bairro, cidade, estado
- Toggle "Menor de idade ou incapaz": ativa campos do responsável legal (nome, CPF, parentesco, RG, telefone, e-mail) — mensagens automáticas desse cliente vão pro telefone do responsável

### Perfil do cliente (clique no cliente):
Botões no topo: "Agendar Reunião" (videochamada ou ligação WhatsApp) · "Editar cadastro" · "Excluir cliente"
Abas:
1. Visão Geral — dados de contato, endereço, dados previdenciários, processos vinculados, toggle de mensagens WhatsApp (ativar/bloquear)
2. Processos — lista de processos desse cliente
3. Financeiro — lançamentos e débitos do cliente
4. Documentos — arquivos enviados; botões "Processar INSS" e "Processar Judicial" para processar PDFs com IA; botão "Gerar Documento" para gerar PDF a partir de um modelo
5. E-mail Exclusivo — caixa de entrada de e-mails recebidos no endereço exclusivo do cliente

### Processar INSS (aba Documentos do cliente):
- Faça upload do PDF → clique em "Processar INSS" → modal abre → IA extrai dados automaticamente → revise → confirme
- O que cria automaticamente conforme o tipo:
  • Agendamento de perícia médica → cria a perícia em Controles + agenda lembretes WhatsApp
  • Agendamento de avaliação social → idem
  • RPV → registra em Controles como Alvará
  • Comprovante de pagamento → registra em Controles como Implantado
  • Resultado de perícia → registra em Controles como Perícia
- Para documentos judiciais: botão "Processar Judicial" (ao lado do botão INSS)

### Agendar Reunião (botão no perfil do cliente):
- Escolha entre: "Google Meet" (envia link pelo WhatsApp) ou "Ligação WhatsApp" (você liga; ideal para quem não usa Meet)
- Preencha título, data, hora; se Meet: informe o link
- O sistema envia 3 mensagens WhatsApp automaticamente: convite imediato + lembrete na véspera + lembrete no dia do evento
- Isso cria um "Compromisso" (tabela separada de Controles) — aparece no mini-calendário do Dashboard e na Agenda com ponto azul

## PROCESSOS (menu: Jurídico → Processos)
- Lista com abas internas no topo: "Lista de Processos" · "Intimações" · "Monitoramento" · "Andamentos" · "Pendências"
- Aba Pendências: todas as pendências (documentos/ações que faltam do cliente) em aberto, de todos os processos, num lugar só — ordenadas da mais antiga pra mais nova, com aviso visual (bolinha vermelha) a partir de 15 dias sem resposta. Botão "WhatsApp" já abre a conversa com o número do cliente (ou do responsável legal, se for menor/incapaz) e a mensagem pronta. Botão de marcar resolvida direto na lista, sem precisar abrir o processo. Existe busca por cliente/processo/descrição
- Botão "Novo Processo" → formulário com campos: cliente, número do processo (CNJ), tipo de ação, área jurídica, fase processual, data de distribuição, dados previdenciários (DER, DIB, DCB, protocolo INSS, resultado administrativo, número do benefício), modelo de honorários (Fixo/Percentual/Misto/Sucumbência/Sem custo), tribunal/vara, observações

### Detalhe do processo:
- Linha de Produção no topo: stepper visual Análise → Produção → Administrativo → Judicial → Arquivado
- Logo abaixo do stepper, uma faixa "Próxima ação" resume em uma frase o que falta fazer no caso (ex: "Dar entrada no requerimento administrativo (INSS)", "INSS indeferiu — ingressar com ação judicial", "Aguardando resultado do INSS") — calculada automaticamente a partir do estágio e dos resultados administrativo/judicial, sem precisar de tarefa manual; fica vermelha quando é urgente
- Abas: "Dados" · "Relato" · "Linha do tempo"
- Linha do tempo: adicionar histórico, criar evento de controle, criar tarefa, criar pendência — com botões de baixa, reabertura, exclusão
- Seletor de Responsável mostra quantas tarefas/controles cada colaborador já tem em aberto (e ⚠ se tiver algo vencido) — ajuda a não sobrecarregar ninguém
- Ao criar uma tarefa do processo: além do responsável principal, dá pra marcar "Colaboradores adicionais" (múltiplos responsáveis) — eles também passam a ver a tarefa em Minhas Tarefas. Depois de criada, dá pra adicionar/remover colaboradores adicionais direto na lista de Tarefas do processo (botão "+ colaborador"). Também dá pra definir um checklist obrigatório (um item por linha) que precisa estar todo marcado antes de dar baixa na tarefa
- Botões de avanço: "Mover para Produção", "Registrar resultado Administrativo", "Registrar resultado Judicial", "Arquivar", "Reabrir", "Voltar etapa"
- "Arquivar" abre um formulário pedindo o resultado final (Deferido, Indeferido, Sentença favorável, Desistência, etc.) e observação — existe só essa via de arquivamento no processo, para o estágio da Linha de Produção e o status do processo nunca ficarem dessincronizados
- Seção Cérebro Jurídico + IA Jurídica (ver seção própria abaixo)
- Seção Documentos: upload de documentos do processo

## CÉREBRO JURÍDICO (dentro do detalhe de cada processo)
- Roda AUTOMATICAMENTE em segundo plano — não precisa apertar botão: sempre que um novo andamento é lançado na Linha do Tempo, ou um documento é enviado ao processo, o Cérebro analisa sozinho logo depois (em background, sem travar a tela)
- Também tem um scheduler diário que revisita casos parados
- O que ele produz: risco do caso, probabilidade de êxito, tese principal, se o andamento é urgente (nesse caso já cria uma tarefa "Alta" prioridade sozinho)
- Aprende com o resultado: quando um processo é arquivado/encerrado com resultado (administrativo ou judicial), o Cérebro registra esse desfecho pra refinar as próximas análises daquela área
- Painel "IA Jurídica" no processo tem 3 passos manuais complementares (esses sim acionados pelo usuário): "Analisar Documento" (Passo 1, lê PDF/imagem), "Diagnóstico Estratégico" (Passo 2, probabilidade de êxito + pontos fortes/frágeis + jurisprudência), "Gerar Petição" (Passo 3, IA "Dr. Lex" redige a peça com prompt em linguagem natural + todos os dados reais do processo/cliente — depois dá pra "Revisar com IA", aplicar correções, ou pedir modificação livre tipo "inclua esse novo laudo"; salva num banco de petições reutilizável, exporta PDF)

## AGENDA (menu: Jurídico → Agenda)
- Calendário que exibe prazos/controles (audiências, prazos, perícias, DCB, benefícios, alvarás), compromissos (reuniões/consultas/videochamadas/fechamentos criados em "Agendar Reunião" ou por perícias/INSS), vencimentos financeiros e aniversários de clientes — e eventos do Google Calendar se conectado
- Visualização apenas — não há botão de criação de compromissos na agenda
- Compromissos são criados nos módulos específicos (Controles, Perícias, perfil do cliente → "Agendar Reunião")

## CONTROLES E PERÍCIAS (menu: Jurídico → Controles)
A seção abre com sub-navegação no topo: "Controles" e "Perícias"

### Aba Controles:
- Filtros por tipo: Audiências · Prazos Processuais · Perícias e Av. Sociais · Prorrogação (DCB) · Benefícios – Ag. Implantação · Benefícios Implantados (1° Pag.) · Benefícios Implantados · Alvarás/RPVs
- Status disponíveis: Aguardando · Concluído · Cancelado
- Botão "Novo {tipo}" (ex: "Nova audiência", "Novo prazo", "Novo alvará") → formulário com data, descrição, cliente, processo, responsável, local, prioridade, observações
- Ao escolher o responsável, o formulário mostra quantas tarefas/controles abertos cada pessoa já tem (e um aviso ⚠ se tiver algo vencido)
- Checklist obrigatório (opcional): campo de texto (um item por linha) na criação; na edição do controle, lista com caixinhas de marcar + botão para adicionar/remover itens. Enquanto houver item não marcado, o botão "Dar baixa" fica bloqueado
- Tempo registrado: na edição do controle, mostra o histórico de cronômetro (ver Minhas Tarefas) somado
- Criação automática via botão "Processar INSS" na aba Documentos do cliente

### Aba Perícias (clique em "Perícias" na sub-navegação):
- Lista todas as perícias médicas e avaliações sociais com status
- Botão "Nova Perícia" → formulário com campos: cliente, processo, tipo, data, hora, local, observações
- Tipos disponíveis: Perícia Administrativa, Perícia Judicial, Avaliação Social Administrativa, Avaliação Social Judicial, Prorrogação de Benefício
- Status: Agendado · Realizado · Cancelado · Remarcado
- Criação automática ao processar documento de agendamento com o botão "Processar INSS"

## PUBLICAÇÕES (menu: Jurídico → Publicações)
Monitoramento automático de publicações e intimações judiciais. 4 abas:

1. **Automática** — publicações capturadas pelas fontes:
   - DJe / eSAJ (TJAL e outros tribunais estaduais): busca por OAB cadastrada
   - DJEN / PJe federal (TRF5): busca automática por número de processo
   - TramitaSign: sincronização diária via credenciais
   - DataJud: busca por número CNJ (requer DATAJUD_API_KEY)
   - Cron automático diário + botão "Verificar agora" para busca manual imediata
   - Cada card exibe: tipo (Intimação/Despacho/etc.), tribunal, processo, data, prazo em dias úteis (Lei 11.419/2006), ação necessária, resumo IA (gerado automaticamente pra toda publicação com conteúdo — não é manual)
   - Prazo colorido: VENCIDO (vermelho escuro), ≤3 dias (vermelho), ≤7 dias (âmbar), >7 dias (verde)
   - Status: "Não lida" → "Tratada"; botão "Marcar tratada" / "Desfazer"

2. **Manual** — registrar intimação manualmente (formulário: processo, tipo, destinatário, órgão, tribunal, data, conteúdo)

3. **OABs** — adicionar/remover OABs monitoradas; botão "Verificar agora" busca todas as fontes na hora

4. **Status** — KPIs (total / não lidas / tratadas / OABs ativas), diagnóstico de configuração das fontes, botão "Verificar configuração"

- Clique em qualquer publicação → página de detalhe com resumo inteligente, timeline de prazos, texto integral
- Notificação automática por WhatsApp ao número do escritório quando há novas publicações

## LEIS & DOU (menu: Jurídico → Leis & DOU)
- Monitoramento automático do Diário Oficial — INSS, Previdência Social e legislação previdenciária
- Botão "Buscar Atualizações" para disparar busca manual
- Cards com impacto (Alto · Médio · Baixo), análise da IA e ação recomendada
- Botão "Marcar como lida" em cada card

## CRM (menu: Negócios → CRM)
- Abas: "Funil de Vendas" (kanban com colunas por estágio) · "Lista de Leads" (tabela paginada com busca)
- Estágios do funil: Novo Contato → Consulta Agendada → Em Análise → Proposta Enviada → Fechado (+ coluna Perdido)
- Botão "+ Novo Lead" → formulário com nome, telefone, e-mail, interesse, estágio, responsável, observações
- Cards do kanban são arrastáveis entre colunas para mudar de estágio
- Leads do WhatsApp via PrevBot entram automaticamente no CRM
- Botão "Converter em Cliente" no perfil do lead

## PRODUÇÃO (menu: Negócios → Produção)
- Kanban de processos em andamento com colunas: Análise · Produção · Administrativo · Judicial · Arquivado
- Não há botão de criação aqui — processos entram via botão "Mover para Produção" no detalhe de cada processo
- Cada card mostra uma faixa "Próxima ação" (ou "Aguardando", em azul, quando a entrada já foi dada e só falta o resultado)
- Direto no card: "Registrar Protocolo" (administrativo) e "Registrar Distribuição" (judicial) marcam que a entrada foi dada, sem precisar abrir o processo

## FINANCEIRO (menu: Negócios → Financeiro)
- Abas: "Lançamentos" (padrão) · "Remunerações" · "Contas"
- Aba Lançamentos: KPIs (a receber, recebido, a pagar, pago, folha), lista paginada com filtros
- Botões: "Nova Receita" (verde) e "Nova Despesa" (vermelho) → formulário com tipo, descrição, valor, vencimento, status, cliente, processo; suporte a parcelamento de honorários
- Quando lançamento de honorário tem cliente com telefone cadastrado: sistema agenda lembretes de cobrança por WhatsApp automaticamente (antes do vencimento)
- Registrar pagamento: no lançamento → "Registrar Pagamento" → sistema envia confirmação ao cliente por WhatsApp
- Quando um lançamento de honorário do cliente (vinculado a um processo) é marcado como pago, o sistema gera automaticamente a comissão do colaborador responsável (percentual configurado no cadastro dele, pela fase do processo) como uma remuneração "Pendente" em Remunerações — se o cliente pagar parcelado, cada parcela paga gera sua própria comissão pendente, na mesma cadência

## MEU FINANCEIRO (menu: Equipe → Meu Financeiro)
- Visão financeira pessoal do colaborador logado
- Exibe: lançamentos pessoais, todos os processos ativos do colaborador (com a comissão calculada pela fase, ou "Não cadastrado"/"Lançado"), honorários aguardando resultado, fluxo do mês
- Somente visualização — a comissão em si é configurada no cadastro do colaborador (Equipe → Colaboradores → editar) e paga de fato em Remunerações

## MODELOS DE DOCUMENTOS (menu: Documentos → Modelos)
- Documentos padrão do escritório: procurações, contratos, declarações, petições, etc. — mala-direta com variáveis {{nome}} etc, diferente do "Dr. Lex" do Cérebro Jurídico (que gera peça específica com dados reais e argumentação, não um molde)
- Botão "Novo Modelo" → formulário com título, categoria, editor de texto rico, toggle "Papel timbrado"
- Categorias: Contratos · Procurações · Declarações · Notificações · Petições · Previdenciário · Família · Trabalhista · Outro
- Variáveis automáticas: Cliente ({{nome}}, {{cpf_cnpj}}, {{email}}, {{telefone}}, {{data_nascimento}}, {{rg}}, {{estado_civil}}, {{profissao}}, {{nacionalidade}}), Responsável ({{responsavel_nome}}, {{responsavel_cpf}}, {{responsavel_rg}}, {{responsavel_telefone}}, {{responsavel_parentesco}}), Endereço ({{endereco}}, {{endereco_completo}}, {{bairro}}, {{cidade}}, {{estado}}, {{cep}}), Geral ({{data_hoje}}, {{advogado}})
- Gerar modelo com IA: botão "Gerar com IA" → envia arquivo de exemplo (PDF/imagem) ou cola texto → a IA reconstrói o documento em blocos formatados e insere as variáveis certas
- Para usar com um cliente: aba Documentos do cliente → "Gerar Documento" → escolhe o modelo → variáveis preenchidas automaticamente

## ASSINATURAS (menu: Documentos → Assinaturas)
- Envelopes de assinatura digital via TramitaSign
- Botão "Novo envelope" → formulário com nome, prazo, lista de assinantes (nome + e-mail)
- Status dos envelopes: Rascunho · Aguardando · Concluído · Expirado · Cancelado

## PDFs (menu: Documentos → PDFs)
- 8 ferramentas: Comprimir · Dividir · Converter imagens em PDF · Juntar · Remover senha · Proteger · Dividir por tipo de documento (IA) · Converter PDF em imagens

## MINHAS TAREFAS (menu: Equipe → Minhas Tarefas)
- Kanban pessoal com colunas: "Pendentes" · "Em Andamento" · "Concluídas"
- Mostra tarefas e controles atribuídos ao usuário logado, incluindo tarefas onde ele é "colaborador adicional" (múltiplos responsáveis)
- A coluna "Pendentes" também mostra automaticamente uma "ação pendente" derivada do estágio do processo (sem precisar de tarefa manual), marcada "Ação urgente" quando crítica
- Cada card tem um botão "Cronômetro" (timesheet) — inicia/para o cronômetro daquele item; iniciar um novo encerra automaticamente qualquer outro que estivesse rodando
- Se o item tiver checklist obrigatório, aparece no card com caixinha de marcar; "Dar baixa" só libera com tudo marcado

## COLABORADORES (menu: Equipe → Colaboradores)
- Lista de todos os colaboradores do escritório
- Botão "Novo Colaborador" → formulário com nome, categoria (Administrador, Sócio, Advogado, Estagiário, Colaborador), permissões
- Cadastro/edição: seção "Comissão por fase do processo" (% administrativo, judicial, ou ambos) e seção "Metas com bônus escalonado" — até 3 faixas (Meta 1/2/3), cada uma com valor de comissão recebida no mês e bônus fixo correspondente; vale só o degrau mais alto batido, não soma os três
- Na página do colaborador: card "Meta do mês" mostra a comissão recebida até agora, meta atingida e valor do bônus; botão "Gerar bônus do mês" cria uma "Bonificação" pendente em Remunerações (geração sempre manual)

## TESTE DISC (menu: Equipe → Teste DISC)
- Testes comportamentais para seleção de colaboradores (metodologia DISC)
- Botão "+ Novo Teste" → formulário com nome do candidato, cargo/vaga
- Resultado mostra perfil dominante (A/B/C/D), função sugerida, recomendação, pontuações

## GERENCIADOR (menu: Sistema → Gerenciador)
- Painel analítico completo do escritório (somente Administradores) — KPIs de clientes, processos, colaboradores, receitas, leads CRM

## CONTROLADORIA (menu: Sistema → Controladoria)
- Ranking de pontuação por colaborador (tarefa/controle concluído vale pontos), período 7/30/90 dias
- Carga da equipe — quantas tarefas/controles abertos cada colaborador tem, com alerta de vencido
- Capacidade produtiva — o que entrou vs. o que saiu por semana, últimas 8 semanas
- Visível pra todos (cada um vê a própria posição no ranking)

## AUDITORIA (menu: Sistema → Auditoria)
- Log de todas as ações do sistema, com filtros por usuário/ação/módulo/período/busca

## RELATÓRIOS (menu: Sistema → Relatórios)
- Relatórios financeiros: lançamentos, resumo, remunerações, fluxo mensal (12 meses), recibo por cliente, dados jurídicos

## INTEGRAÇÕES (menu: Sistema → Integrações)
- Cards com status (Configurado / Não configurado / Em breve / Conectado): Asaas (cobrança), E-mail Inbound, TramitaSign, WhatsApp (PrevBot), Google Calendar
- Rota de teste WhatsApp: Integrações → "Testar WhatsApp"

## USUÁRIOS (menu: Sistema → Usuários)
- Lista de usuários com acesso ao sistema; botão "Novo Usuário"

## CONFIGURAÇÕES (menu: Sistema → Configurações — somente Administradores)
- Abas "Escritório" (nome, OAB, CNPJ, logomarca, endereço) e "Mensagens Automáticas" (textos e intervalos de WhatsApp)
- Comissão de colaborador não fica aqui — é no cadastro do próprio colaborador

## MENSAGENS WHATSAPP AUTOMÁTICAS
- Enviadas via PrevBot; cliente precisa ter telefone cadastrado e não estar bloqueado
- Tipos automáticos: lembretes de perícia/INSS (15/5/2 dias antes + véspera + dia), cobranças de honorário, confirmação de pagamento, convite de reunião + lembretes
- Personalizar: Configurações → "Mensagens Automáticas"
- Bloquear por cliente: perfil do cliente → Visão Geral → toggle`;
