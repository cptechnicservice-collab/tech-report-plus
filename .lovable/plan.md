# Confiabilidade do apontamento

## Implementação
- Adicionar confirmação antes da exclusão e incluir o motivo disponível nas mensagens de falha ao salvar ou excluir.
- Marcar toda edição de apontamento com `sync_status = 'pending'`, preservando o restante do fluxo.
- Centralizar a análise dos horários para identificar pares incompletos, viradas para o dia seguinte, jornada acima de 16h e intervalos inválidos.
- Não descontar intervalos fora da jornada ou maiores que ela; manter os demais totais existentes.
- Exibir avisos abaixo das respectivas seções e bloquear o salvamento somente quando Trabalho tiver apenas um dos dois horários.
- Atualizar apenas o placeholder de Máquina / Serviço solicitado.
- Envolver o botão de exclusão existente em uma confirmação com as ações Cancelar e Excluir.

## Validação
- Testar os cálculos e avisos para pares incompletos, virada de dia, intervalo inválido, KM regressivo e jornada longa.
- Verificar edição com estado de sincronização pendente, confirmação de exclusão e ausência de erros no app.
- Não criar registros permanentes durante os testes.

## Detalhes técnicos
- Preservar visual geral, rotas, dados, autenticação atual e demais comportamentos.
- Reutilizar o componente de confirmação e os tokens visuais existentes.
