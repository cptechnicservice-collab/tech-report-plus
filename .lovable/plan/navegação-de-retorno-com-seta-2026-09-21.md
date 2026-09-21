# Navegação de retorno com seta

## Alterações
- Adicionar ao cabeçalho uma ação opcional de retorno usando somente o ícone de seta, com identificação acessível para leitores de tela.
- Mostrar a seta nas telas abertas a partir de outra tela: edição de relatório, edição de apontamento, edição/criação de orçamento e opções secundárias do menu Mais.
- Definir destinos previsíveis: relatório editado volta aos Relatórios salvos; apontamento editado volta ao Histórico; orçamento volta à lista de Orçamentos; cadastros e listas secundárias voltam ao Mais.
- Manter as cinco telas principais da barra inferior sem seta, evitando navegação duplicada.

## Validação
- Conferir o retorno da edição de relatório no tamanho de iPhone.
- Revisar os demais destinos, o encaixe do ícone no cabeçalho e confirmar que não há erros.

## Detalhes técnicos
- Reutilizar o componente de cabeçalho e o componente de botão existentes.
- Usar links de navegação do aplicativo, preservando acesso por toque, teclado e leitores de tela.
