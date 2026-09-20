# Numeração única dos relatórios

## Objetivo
Adicionar um número de série permanente no canto superior direito do PDF, sem alterar cálculos ou outras funções.

## Implementação
- Salvar em cada relatório um identificador exclusivo no formato `RT-...`, protegido contra duplicidade no banco.
- Gerar o identificador também sem internet e sincronizá-lo junto com o relatório.
- Preservar o mesmo número ao editar ou gerar novamente o mesmo relatório.
- Exibir o número no cabeçalho, acima da data de emissão.
- Preencher números exclusivos para relatórios já existentes.

## Validação
- Gerar PDFs de relatórios diferentes e confirmar números diferentes.
- Gerar novamente o mesmo relatório e confirmar que o número permanece igual.
- Conferir a prévia A4 e a compilação, sem publicar.
