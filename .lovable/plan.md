# Sincronização offline confiável

## Objetivo
Tornar a fila offline visível, automática e recuperável, preservando sua arquitetura, ordem e regras atuais.

## Implementação
- Disparar a sincronização ao abrir e retornar ao app, ao recuperar foco/conexão e a cada 2 minutos enquanto visível, mantendo uma única execução por vez.
- Adicionar em cada operação o horário da próxima tentativa e aplicar atrasos progressivos de 5 s, 15 s, 1 min, 5 min e 15 min.
- Preservar a prioridade atual das entidades, a ordem por criação e a substituição por entidade + registro.
- Registrar o horário da última sincronização concluída no armazenamento local do aparelho.
- Renovar o indicador com quantidade pendente, quantidade com falha, último horário e ação “Sincronizar agora”.
- Após três falhas, mostrar um painel de atenção com identificação legível, tentativas, erro e ações para tentar novamente, abrir o registro ou descartar com confirmação.
- Manter falhas de rede interrompendo o envio; falhas de validação/permissão continuam nas operações seguintes e contam tentativas.
- Não exibir nem executar a sincronização sem uma sessão válida.

## Validação
- Confirmar compilação e ausência de erros.
- Simular fila, falha, repetição e descarte no tamanho de tela do iPhone.
- Confirmar que operações com espera futura são respeitadas e que “Sincronizar agora” permite nova tentativa imediata.
