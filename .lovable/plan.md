# Ajustes econômicos de horário e interface

## Implementação
- Substituir o comportamento direto dos horários por um seletor que só atualiza o formulário após confirmação; cancelar mantém o valor anterior.
- Exibir um botão “×” em cada horário preenchido para limpar somente esse campo e removê-lo imediatamente dos cálculos.
- Recolher inicialmente Viagem ida, Intervalo, Viagem retorno e Quilometragem, abrindo automaticamente se já houver dados; ocultar nunca apaga valores.
- Reforçar discretamente a aba ativa da navegação inferior e adicionar o monograma CP aos cabeçalhos.

## Validação
- Testar em viewport de iPhone: horário inicialmente vazio, seleção e confirmação, limpeza com “×” e atualização do total.
- Conferir as telas principais e os diagnósticos sem criar registros permanentes.

## Detalhes técnicos
- Manter rotas, banco, consultas, salvamento e regras de cálculo existentes.
- Usar controles e tokens visuais já presentes no projeto, sem novas dependências ou redesign amplo.
