# Anexos de comprovantes nas despesas

## O que será feito
- Ampliar cada despesa extra com tipo, data e uma lista de fotos de comprovantes.
- Permitir tirar ou escolher várias fotos, visualizar em tela cheia, substituir e excluir cada anexo.
- Mostrar clipe e contador na própria despesa quando houver comprovantes.
- Redimensionar as imagens com o mesmo processo já usado nas peças e salvar junto ao relatório, inclusive na fila offline existente.
- Acrescentar ao fim do PDF somente quando necessário páginas “Anexos - Comprovantes de Despesas”, em grade de duas imagens por linha, com legenda e sem cortar fotos.
- Preservar integralmente a apresentação e os cálculos da primeira folha.

## Validação
- Conferir no tamanho de tela do iPhone o cadastro, visualização, substituição e exclusão.
- Gerar e inspecionar PDFs com e sem anexos.
- Confirmar compilação sem erros e registrar a entrega no roadmap.

## Detalhes técnicos
- Os anexos ficarão dentro de `despesas_snapshot`, vinculados pelo `id` da despesa, usando imagens JPEG compactadas em data URL como no cadastro de peças.
- Não haverá biblioteca, serviço de arquivos ou tabela nova.
