# Dados da empresa e Orçamentos

## Resultado

- Adicionar em **Mais** as opções **Dados da empresa** e **Orçamentos**, preservando o visual iOS atual.
- Permitir cadastrar os dados fornecidos, escolher uma logo no iPhone, redimensioná-la para até 600 px e mantê-la disponível offline. Sem logo personalizada, usar o ícone atual do app.
- Criar a lista e o editor de orçamentos com numeração anual, cliente, validade, itens de catálogo ou livres, fotos opcionais, desconto, pagamentos, observações e status.
- Permitir duplicar orçamentos e transformar um orçamento aprovado em novo apontamento com cliente e descrição já preenchidos.

## PDFs

- Criar funções compartilhadas para o cabeçalho e o rodapé de todos os PDFs.
- Aplicar o novo padrão ao relatório, recibo e orçamento, incluindo logo, empresa, cliente, identificação do documento e assinatura.
- Gerar o orçamento com tabela zebrada, totais, observações e compartilhamento nativo do iPhone, mantendo download como alternativa.
- Corrigir o texto de valores monetários e conferir: R$ 1.100,00; R$ 1.000.000,00; R$ 2.500,00; R$ 9.335,50.

## Funcionamento offline e segurança

- Criar tabelas privadas para dados da empresa, orçamentos e itens, sempre vinculadas ao usuário e protegidas pelas mesmas regras dos cadastros atuais.
- Reutilizar o cache e a fila offline existentes, sincronizando primeiro a empresa e o orçamento e depois seus itens.
- Guardar logo e fotos já reduzidas como dados de imagem compactos, evitando depender de conexão para editar ou gerar PDFs.
- Manter intactos todos os cálculos atuais de horas, viagens, quilometragem, diárias, despesas e peças.

## Detalhes técnicos

- A numeração sugerida será calculada pelo maior número do ano disponível no cache/banco, formatada como `NNNN-AA`, mas continuará editável e única por usuário.
- O desconto aceitará valor em reais ou percentual; subtotal, produtos, serviços e total serão recalculados no formulário.
- Os itens serão salvos separadamente, mas o cache manterá cada orçamento completo para uso offline.
- A validação final incluirá fluxo completo em 440×807, geração e inspeção visual de todas as páginas do PDF de teste e confirmação do estado de compilação.