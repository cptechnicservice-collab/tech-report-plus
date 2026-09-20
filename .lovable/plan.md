# Comprovantes em PDF nas despesas

## O que será feito
- Aceitar comprovantes em PDF de até 5 MB, além das fotos existentes.
- Permitir visualizar, substituir e excluir o PDF na mesma despesa, mantendo o contador de anexos.
- Salvar o arquivo junto da despesa e usar a fila offline atual, sem serviço de armazenamento novo.
- Ao gerar o relatório, manter todas as páginas atuais intactas e acrescentar todas as páginas de cada PDF ao final.
- Fazer cada arquivo PDF começar em uma página exclusiva, preservando o conteúdo sem cortes.

## Validação
- Conferir seleção, limite, visualização, substituição e exclusão no tamanho do iPhone.
- Gerar relatórios sem PDF, com PDF de várias páginas e com foto mais PDF.
- Inspecionar visualmente todas as páginas e confirmar compilação sem erros.

## Detalhes técnicos
- O anexo armazenará tipo, nome e conteúdo em data URL dentro de `despesas_snapshot`; anexos antigos em formato de imagem continuarão funcionando.
- Será usada uma biblioteca compatível com o navegador para copiar páginas de PDFs, sem alterar recibos ou orçamentos.
