# Evolução do CP Technician Log

## Objetivo
Modernizar o app inteiro sem perder os dados, o funcionamento offline ou os cálculos atuais. As funções de Peças, Agenda, Valores por vigência, horários separados e detalhamento financeiro já existem em parte; a evolução vai unificá-las, acrescentar estoque e permitir vincular peças diretamente ao apontamento, além do vínculo já disponível no relatório.

## Direção visual
- Manter a marca **CP TECHNIC** com “CP” branco, traço azul e fundo preto no cabeçalho/identidade.
- Adotar superfícies claras, tipografia de sistema do iPhone, maior respiro, divisórias discretas e azul apenas para ações e estados ativos.
- Criar um padrão reutilizável de **campo com label flutuante** para texto, moeda, data, horário, busca e seleção. O label permanece visível acima do valor quando o campo estiver focado ou preenchido.
- Manter botões principais largos e fáceis de tocar; usar ícones para editar, excluir, limpar e voltar.
- Preservar a barra inferior atual: **Painel, Agenda, Apontar, Histórico e Mais**.
- Aplicar a atualização visual também aos estados vazio, carregando, erro, sem internet e sincronização pendente.

## Prévia conceitual

### Cabeçalho e campos
```text
┌──────────────────────────────────┐
│ CP TECHNIC                 [sair]│
│ Novo apontamento                 │
│ Registro manual de atendimento   │
├──────────────────────────────────┤
│ Cliente                          │  ← label sobe ao focar/preencher
│ Móveis Exemplo               ⌄   │
├──────────────────────────────────┤
│ Máquina / serviço                │
│ Seccionadora — revisão           │
└──────────────────────────────────┘
```

### Blocos de horários
```text
┌ Viagem de ida ───────── Opcional ┐
│ Saída  07:00       Chegada 08:15 │
└──────────────────────────────────┘
┌ Trabalho ────────────────────────┐
│ Início 08:15       Fim     17:00 │
└──────────────────────────────────┘
┌ Intervalo ───────────── Opcional ┐
│ Início 12:00       Fim     13:00 │
└──────────────────────────────────┘
┌ Viagem de retorno ───── Opcional ┐
│ Saída  17:00       Chegada 18:20 │
└──────────────────────────────────┘
```

## Alterações por tela

### 1. Peças
**O que já existe:** catálogo com descrição, código, unidade, preço, foto, observação, busca, edição, exclusão e uso offline; peças também podem ser incluídas no relatório com quantidade.

**O que muda:**
- Renomear visualmente “Descrição” para **Nome da peça**, mantendo compatibilidade com os registros atuais.
- Acrescentar **Estoque (opcional)**, aceitando vazio, zero e quantidade decimal quando necessário.
- Reorganizar o cadastro em: foto, nome, código, unidade, valor, estoque e observação.
- Mostrar na lista nome, código, valor/unidade e estoque; estoque vazio aparece como “Não controlado”.
- Manter busca sem diferença de acentos ou maiúsculas.
- Manter foto, funcionamento offline, edição e confirmação antes de excluir.

### 2. Novo apontamento / edição de apontamento
- Criar a seção **Peças utilizadas** dentro do apontamento.
- Permitir pesquisar uma peça do catálogo, adicionar, informar quantidade, limpar a escolha e remover o item.
- Exibir subtotal apenas para conferência, sem alterar os cálculos de horas, viagens, quilômetros ou despesas.
- Salvar o preço, nome, código e unidade usados naquele momento para que mudanças futuras no catálogo não alterem apontamentos antigos.
- Organizar os horários em quatro blocos claros: **Viagem de ida**, **Trabalho**, **Intervalo** e **Viagem de retorno**.
- Viagem de ida, intervalo e viagem de retorno continuam opcionais e independentes, cada um com início e fim manuais. Trabalho continua opcional, preservando dias somente de viagem.
- Aplicar labels flutuantes a identificação, horários, quilômetros, despesas e observações.

### 3. Agenda
**O que já existe:** lista agrupada por data, cliente, início/fim, horário, máquina/serviço, observação, conclusão, edição, exclusão e “Iniciar apontamento”, inclusive offline.

**O que muda:**
- Manter o botão **Novo agendamento** no cabeçalho e torná-lo mais evidente sem duplicar ações.
- Refinar a lista em formato de agenda: marcador de data, horário previsto, cliente em destaque, máquina/serviço e observação secundária.
- Destacar **Hoje**, próximos atendimentos e concluídos com estados visuais distintos.
- Modernizar o formulário com labels flutuantes para cliente, início, fim, horário previsto, máquina/serviço e observação.
- Manter “Iniciar apontamento” preenchendo cliente, data e serviço.

### 4. Valores
**O que já existe:** histórico por data de vigência com hora trabalhada, hora de viagem, quilômetro, diária inteira e meia diária; o cálculo já escolhe a tarifa vigente na data de cada apontamento.

**O que muda:**
- Reorganizar a tela em **Tarifa vigente** e **Histórico de reajustes**.
- Exibir a data “Vigente desde” com mais destaque.
- Usar labels flutuantes e máscara monetária nos valores.
- Manter também meia diária, pois já participa dos cálculos existentes.
- Ao editar, preservar o histórico; não recalcular relatórios salvos, que continuam usando seus valores congelados.
- Avisar visualmente quando um período não tiver tarifa aplicável, evitando totais silenciosamente zerados.

### 5. Relatório
**O que já existe:** seleção de cliente e período, peças utilizadas, valores por trabalho, viagem, KM, diárias, pedágios, outras despesas, despesas adicionais, desconto e total; o PDF possui snapshots que protegem relatórios antigos.

**O que muda:**
- O filtro de cliente ganhará a opção **Todos os clientes** para consulta na tela.
- Com “Todos os clientes”, mostrar totais consolidados e uma lista por cliente; para salvar ou gerar o PDF individual atual, será necessário selecionar um cliente específico. Isso preserva o modelo atual de relatório por cliente.
- Criar um bloco mais legível chamado **Detalhamento financeiro**, sempre na mesma ordem:
  1. Trabalho
  2. Viagem
  3. Quilometragem
  4. Diárias
  5. Pedágios
  6. Outras despesas
  7. Peças utilizadas
  8. Despesas adicionais, quando existirem
  9. Desconto, quando existir
  10. Total geral
- As peças vinculadas aos apontamentos do período serão reunidas automaticamente em **Peças utilizadas**; ainda será possível complementar a seleção no relatório antes de salvá-lo.
- Evitar duplicidade quando a mesma peça já veio de um apontamento e foi adicionada manualmente: somar quantidades pela mesma referência.
- Preservar a primeira folha e a estrutura atual do PDF, fazendo somente os ajustes necessários para incluir as peças vindas dos apontamentos e manter os totais corretos.

### 6. Painel, Histórico, Clientes, Mais e telas auxiliares
- Aplicar o mesmo cabeçalho, espaçamento, campos flutuantes, listas e estados visuais.
- Preservar filtros, atalhos, recebimentos, orçamentos, anexos e setas de retorno existentes.
- Não mudar a lógica financeira nem a navegação principal.

## Componentes compartilhados
- **FloatingField**: base visual e acessível para label flutuante, erro, ajuda e estado desabilitado.
- **FloatingInput / FloatingTextarea / FloatingSelect**: variações para texto, moeda, data, horário e seleção.
- **PartPicker**: busca, seleção, quantidade, limpeza e remoção de peças; usado em apontamento e relatório.
- **FinancialBreakdown**: lista padronizada do detalhamento financeiro e total geral.
- **ScheduleItem**: linha compacta e consistente da agenda.
- Ajustar os componentes atuais de seção e cabeçalho para a nova hierarquia visual, sem criar cartões dentro de cartões.

## Banco de dados e proteção dos registros

### Alteração em `pecas`
- Adicionar `estoque` numérico opcional, com validação para não aceitar valor negativo.
- Manter cada peça privada por conta, com as mesmas permissões e proteção atuais.

### Nova tabela `apontamento_pecas`
- `id`
- `user_id`
- `apontamento_id`
- `peca_id` opcional, para manter o histórico mesmo se a peça do catálogo for excluída
- snapshot de `nome`, `codigo`, `unidade`, `valor_unitario` e `foto`
- `quantidade`
- datas de criação e alteração
- Índice por apontamento e por usuário.
- Permissões explícitas e regras para cada conta acessar apenas seus próprios registros.

### Sem nova tabela para Agenda ou Valores
As tabelas atuais já cobrem os campos pedidos e já estão ligadas à conta do usuário. A implementação apenas preservará e refinará esses fluxos.

## Funcionamento offline
- Estender o cache e a fila existentes para `apontamento_pecas` e para o novo campo de estoque.
- Salvar primeiro o apontamento e depois suas peças, mantendo a ordem correta da sincronização.
- Permitir adicionar, editar e remover peças do apontamento sem internet.
- Preservar relatórios salvos como snapshots imutáveis de cliente, tarifas, apontamentos, peças e totais.

## Regras de cálculo preservadas
- As horas continuam sendo calculadas a partir de horários digitados manualmente; nenhum horário automático será introduzido.
- Cada apontamento usa a tarifa cuja vigência seja a mais recente e não posterior à sua data.
- Relatórios já salvos permanecem com os valores históricos congelados.
- Peças usam quantidade × valor unitário do snapshot.
- Não alterar os cálculos atuais de trabalho, viagem, quilômetros, diárias, pedágios, despesas, descontos ou recebimentos.

## Ordem de implementação
1. Criar os novos componentes visuais e validar o padrão de label flutuante.
2. Adicionar estoque e vínculo de peças por apontamento no banco, com segurança e índices.
3. Integrar estoque e peças de apontamento ao modo offline.
4. Atualizar Peças e o formulário de apontamento.
5. Refinar Agenda e Valores.
6. Atualizar o filtro e o detalhamento financeiro do Relatório.
7. Aplicar a modernização consistente às demais telas, sem alterar seus fluxos.
8. Ajustar o PDF somente onde necessário para refletir as peças vinculadas.

## Validação
- Conferir criação, edição, exclusão e busca de peças, com e sem estoque.
- Testar peça vinculada ao apontamento e sua aparição no relatório/PDF.
- Testar Agenda completa e “Iniciar apontamento”.
- Confirmar tarifa correta antes e depois de uma data de reajuste, inclusive em relatório antigo salvo.
- Validar todos os blocos opcionais de horário, inclusive atendimento somente com viagem.
- Conferir “Todos os clientes”, cliente específico e detalhamento financeiro.
- Testar inclusão e sincronização offline na ordem correta.
- Revisar todas as telas no tamanho de iPhone, incluindo teclado aberto, listas longas e campos preenchidos.
- Gerar PDFs com e sem peças e confirmar que anexos e páginas atuais permanecem intactos.
- Confirmar ausência de erros de compilação, tela e sincronização.

## Limites desta etapa
- Estoque será apenas informativo; não haverá baixa automática, movimentações ou alertas de reposição.
- “Todos os clientes” será uma visão consolidada na tela; não criará um PDF misturando clientes.
- Não haverá integração com o Calendário do iPhone nem notificações automáticas.
