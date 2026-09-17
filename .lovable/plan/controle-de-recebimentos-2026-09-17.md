# Controle de recebimentos

## O que será entregue

- Cada relatório salvo terá status **Pendente**, **Parcial** ou **Pago**, além de valor recebido, data e forma de pagamento.
- Relatórios existentes continuarão disponíveis e aparecerão como **Pendente**.
- A lista de relatórios ganhará selo e filtro por status, preservando busca e filtros de período.
- Cada relatório terá uma ação **Registrar recebimento**, abrindo uma folha inferior no padrão visual atual do iPhone.
- O Painel mostrará **A receber**, somando o saldo restante e contando os relatórios ainda em aberto; o toque abrirá a lista já filtrada.
- Relatórios com recebimento terão **Gerar recibo**, com cliente, período, valor por extenso, forma, data e assinatura.
- Relatórios e recibos usarão o compartilhamento nativo do iPhone quando disponível, mantendo o download como alternativa.

## Regras mantidas

- Nenhuma mudança nos cálculos de horas, viagem, quilometragem, diárias, despesas ou peças.
- O salvamento de recebimentos seguirá o cache e a fila offline já usados pelo app.
- O status será derivado com segurança do valor recebido: zero é pendente, abaixo do total é parcial e igual ou acima do total é pago.

## Detalhes técnicos

- Criar uma migração incremental na tabela de relatórios salvos, com campos de status, valor recebido, data e forma de pagamento, valores padrão e validações.
- Atualizar tipos, serialização e atualização offline sem criar uma segunda fila.
- Aceitar um filtro de status na URL da tela de relatórios para o atalho do Painel.
- Reaproveitar o gerador de PDF e centralizar o compartilhamento/download de arquivos.
- Validar no viewport de iPhone 440 × 807, incluindo a folha de recebimento, filtros, recibo e navegação pelo card.