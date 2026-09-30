# Plano de melhoria de velocidade e funcionalidade

## Objetivo

Deixar o CP TECHNIC mais rápido no iPhone, mais confiável com internet instável e mais seguro contra perda de trabalho, preservando:

- cálculos atuais de horas, viagens, KM, diárias, peças e descontos;
- PDFs e numerações existentes;
- funcionamento offline e proteção por usuário;
- status operacional separado do recebimento;
- regra de um relatório salvo por orçamento;
- ausência de controle de estoque.

## Diagnóstico confirmado

- A tela **Relatório** abre seis conjuntos completos de dados ao mesmo tempo, mesmo antes de cliente e período serem escolhidos.
- **Relatórios salvos** baixa o documento completo de cada registro, incluindo apontamentos, valores, peças, fotos e anexos; a lista usa apenas uma pequena parte desses dados.
- **Orçamentos** também carrega todos os itens e fotos na listagem, embora os dados completos só sejam necessários ao editar, duplicar, gerar PDF ou enviar ao relatório.
- Painel, Histórico e Agenda carregam todos os registros e filtram no aparelho.
- Ao abrir o app, voltar para ele ou sincronizar, várias listas são atualizadas juntas, mesmo quando nenhuma delas mudou.
- O cache dura sete dias, mas não há um intervalo curto de “dados ainda recentes”; por isso telas já visitadas podem consultar a rede novamente.
- Fotos e PDFs ficam dentro dos próprios registros, aumentando o tamanho da lista, do cache e da fila offline.
- Há um erro recente de navegação registrado com caminho `//`; a origem ainda precisa ser reproduzida antes da correção.
- Formulários longos não protegem contra saída acidental antes de salvar.

## Fase 1 — Rapidez e estabilidade imediatas

### Carregamento inteligente

- Definir um pequeno período de atualização para dados recém-carregados, mantendo a leitura imediata do cache e a atualização em segundo plano.
- Fazer a sincronização informar exatamente quais áreas mudaram e atualizar somente essas áreas, em vez de recarregar Clientes, Apontamentos, Valores, Agenda, Peças, Relatórios, Empresa e Orçamentos em conjunto.
- Evitar uma nova sincronização quando a fila estiver vazia.
- Reproduzir o caminho inválido `//`, identificar sua origem e então corrigir; validar abertura, login, retorno do segundo plano e navegação pela barra inferior.

### Listas leves

- Criar uma consulta resumida para **Relatórios salvos**, trazendo apenas número, cliente, período, totais, status e datas.
- Buscar o relatório completo somente ao editar, gerar PDF/recibo ou abrir valores e anexos.
- Aplicar o mesmo modelo em **Orçamentos**: lista resumida primeiro; itens e fotos somente quando alguma ação precisar deles.
- No **Painel**, consultar apenas o mês selecionado e os dados necessários ao “A receber”.
- No **Histórico** e na **Agenda**, carregar primeiro os registros mais úteis e oferecer continuação ao chegar ao fim, sem remover filtros nem busca.

### Resultado esperado

- Painel e listas aparecem mais rápido.
- Menos uso de internet e memória.
- Fotos e anexos deixam de atrasar telas que não os exibem.
- O modo offline continua funcionando com os dados já disponíveis no aparelho.

## Fase 2 — Segurança contra perda de trabalho

### Rascunho automático no aparelho

- Salvar localmente, durante a digitação, o rascunho de:
  - novo apontamento;
  - orçamento;
  - novo/edição de agendamento;
  - valores e observações/despesas de relatório.
- Ao retornar, oferecer **Continuar rascunho** ou **Descartar**.
- Limpar o rascunho somente após confirmação de salvamento ou descarte.
- Avisar antes de sair quando houver alterações ainda não salvas.

### Sincronização mais clara

- Exibir “Pendente de envio” também em Agenda, Peças, Clientes, Orçamentos e Relatórios salvos.
- Mostrar uma pequena tela de detalhes da fila: quantidade, item com erro e ação para tentar novamente.
- Manter a ordem atual de envio entre registros principais e seus itens.

## Fase 3 — Fluxos mais rápidos no trabalho de campo

### Agenda para apontamento

- Ao tocar em **Iniciar apontamento**, manter o vínculo com o agendamento.
- Depois de salvar o apontamento, marcar o agendamento como concluído mediante confirmação, evitando voltar à Agenda para repetir a ação.
- Se o apontamento for cancelado, o agendamento permanece pendente.

### Orçamento para execução e relatório

- Ao gerar apontamento de um orçamento aprovado, preencher cliente, serviço e peças do orçamento; tudo continua editável antes de salvar.
- Se um orçamento já enviado para Relatórios salvos for alterado depois, mostrar que o relatório está desatualizado e oferecer atualização explícita, sem criar duplicidade.

### Relatórios salvos

- Reorganizar as ações **Recibo**, **Relatório** e **Excluir** para reduzir excesso visual e evitar toques acidentais.
- Quando filtros não encontrarem resultados, mostrar “Nenhum resultado para estes filtros” e um botão para limpar, em vez de indicar que não existem relatórios.
- Manter os filtros escolhidos ao sair e retornar, incluindo situação operacional.

## Fase 4 — Anexos e crescimento futuro

- Manter agora a compatibilidade com fotos e PDFs existentes.
- Preparar a leitura para não carregar anexos até o usuário abrir ou gerar o documento.
- Em uma etapa posterior, migrar anexos grandes para armazenamento de arquivos, mantendo apenas referências nos registros; isso reduz muito o peso do banco e do cache, mas exige migração cuidadosa dos anexos atuais.
- Adicionar paginação/continuação consistente para listas que crescerem ao longo dos anos.

## Componentes e estrutura técnica

- Consultas resumidas e detalhadas separadas para relatórios e orçamentos.
- Chaves de cache por finalidade, mês, período e página.
- Sincronização retornando as áreas realmente alteradas.
- Componente reutilizável de status offline por item.
- Proteção reutilizável de formulário com rascunho local e aviso de saída.
- Vínculo seguro Agenda → Apontamento e reaproveitamento de itens Orçamento → Apontamento.
- Nenhuma alteração nas fórmulas financeiras ou no formato atual dos PDFs.

## Ordem de implementação

1. Diagnosticar/corrigir a navegação `//`, reorganizar ações e melhorar estados vazios.
2. Reduzir atualizações repetidas e configurar cache recente.
3. Tornar Relatórios salvos e Orçamentos leves, carregando detalhes sob demanda.
4. Limitar Painel, Histórico e Agenda por período/página.
5. Adicionar rascunho automático e proteção ao sair.
6. Melhorar indicadores e detalhes da sincronização.
7. Integrar Agenda → Apontamento e Orçamento → Apontamento/Relatório.
8. Avaliar a migração de anexos após medir o ganho das fases anteriores.

## Validação

- Medir abertura inicial e retorno às telas no iPhone antes/depois.
- Testar com rede rápida, rede lenta, sem internet e retorno da conexão.
- Confirmar criação, edição, exclusão e sincronização de cada tipo de registro.
- Validar rascunhos após fechar/reabrir o app e após navegar sem querer.
- Testar PDFs com e sem fotos/PDFs anexados, sem alterar a primeira folha.
- Confirmar que cálculos, status, filtros, numerações e vínculo único do orçamento continuam idênticos.
- Verificar compilação, erros no navegador e ausência de rolagem horizontal.
