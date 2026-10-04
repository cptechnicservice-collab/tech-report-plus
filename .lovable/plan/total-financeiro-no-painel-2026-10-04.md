# Total financeiro no Painel

## Objetivo
Adicionar, acima do seletor **Mensal / Anual**, um cartão **Total** que abra uma nova tela de relatórios totais, sem alterar os cálculos, recebimentos ou funcionamento offline existentes.

## Alterações
- No Painel, inserir o cartão **Total financeiro** antes do seletor mensal/anual, mostrando:
  - valor total dos relatórios;
  - total recebido;
  - total ainda a receber.
- Manter os cartões atuais **A receber** e **Recebidos** com o filtro mensal/anual.
- Criar a tela **Relatórios totais**, acessível pelo cartão Total, com:
  - resumo geral de total faturado, recebido e saldo a receber;
  - quantidades de relatórios pagos, parciais e pendentes;
  - composição dos recebimentos por forma de pagamento;
  - lista dos clientes com seus totais, recebidos e saldos;
  - atalhos para abrir os relatórios recebidos ou em aberto.
- Usar os relatórios já disponíveis no cache do app, mantendo funcionamento offline e isolamento por usuário.
- Adicionar botão de voltar por símbolo e informações próprias para compartilhamento da nova tela.

## Validação
- Conferir no tamanho do iPhone que os valores cabem, não há rolagem horizontal e os botões têm boa área de toque.
- Abrir a nova tela pelo cartão Total e testar os atalhos para recebidos e a receber.
- Repetir a abertura em modo avião.
- Confirmar a compilação sem erros.

## Limites
- Nenhuma mudança em banco, cálculos financeiros, registro de recebimentos, PDFs, rotas existentes ou fila offline.
