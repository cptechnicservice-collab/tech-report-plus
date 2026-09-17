# Editar relatórios salvos e quantidade de peças

## Alterações
- Adicionar uma ação **Editar** em cada relatório salvo.
- Abrir a tela de relatório com o cliente, período, peças, quantidades, preços e cálculos congelados daquele documento.
- Ao salvar durante a edição, atualizar o mesmo relatório, inclusive offline, sem criar uma cópia.
- Manter a geração de PDF usando os dados editados.
- Permitir apagar temporariamente a quantidade da peça e digitar diretamente outro valor, validando ao sair do campo ou salvar.

## Detalhes técnicos
- Identificar o relatório pela URL e carregar seu snapshot no formulário.
- Preservar o `id` e a data original de criação ao atualizar o cache e o banco.
- Usar estado textual no campo numérico para aceitar o valor vazio durante a digitação.
- Validar o fluxo no tamanho de tela do iPhone e confirmar que a aplicação continua sem erros.
