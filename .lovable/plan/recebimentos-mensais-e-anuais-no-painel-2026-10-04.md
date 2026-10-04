# Recebimentos mensais e anuais no Painel

## O que será entregue

- Criar no Painel uma área financeira com os cartões **A receber** e **Recebidos**.
- **Recebidos** somará tudo que entrou no período, incluindo pagamentos parciais e pagamentos completos.
- Adicionar um seletor **Mensal / Anual** exclusivo dessa área, sem alterar o período usado nas horas, quilômetros e composição do Painel.
- Permitir avançar e voltar entre meses ou anos conforme o modo selecionado.
- Filtrar **A receber** pela data do relatório e **Recebidos** pela data registrada no recebimento.
- Ao tocar em cada cartão, abrir Relatórios salvos já filtrado pelo mesmo período e situação financeira.

## Regras mantidas

- Nenhum cálculo atual de apontamentos, serviços, peças, despesas ou saldo será alterado.
- O status operacional continuará separado do status financeiro.
- Cache, funcionamento offline e fila de sincronização permanecerão inalterados.
- Relatórios sem data de recebimento não entrarão em **Recebidos**.

## Detalhes técnicos

- Atualizar o Painel para manter estado próprio do período financeiro e calcular os dois indicadores a partir dos relatórios já carregados.
- Ampliar os parâmetros validados de Relatórios salvos para receber o tipo de lista e o período em `YYYY-MM` ou `YYYY`.
- Na lista, usar a data do relatório para valores em aberto e `data_recebimento` para valores recebidos.
- Exibir claramente quando a lista estiver limitada ao mês ou ano escolhido e permitir limpar os filtros.
- Validar no iPhone: troca mensal/anual, navegação entre períodos, valores, links dos dois cartões e ausência de rolagem horizontal.
