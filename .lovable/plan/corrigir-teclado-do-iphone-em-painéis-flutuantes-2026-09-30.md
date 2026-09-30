# Corrigir teclado do iPhone em painéis flutuantes

## Objetivo
Manter formulários em diálogos e folhas inferiores totalmente visíveis e roláveis acima do teclado do iPhone, sem alterar dados, salvamento, rotas ou funcionamento offline.

## Implementação
- Criar um observador único da área visível do iPhone usando `visualViewport`, atualizando `--kb-inset` e `--vvh` com eventos agrupados por animação e limpeza completa ao desmontar.
- Ativar o observador no layout raiz, preservando a configuração atual da viewport.
- Adaptar os componentes compartilhados de diálogo e folha inferior para subir acima do teclado, limitar a altura à área visível, rolar internamente e respeitar a área segura inferior.
- Centralizar diálogos comuns dentro da área realmente visível quando o teclado estiver aberto, sem mudar sua posição normal com o teclado fechado.
- Ao focar campos dentro desses painéis, aguardar a abertura do teclado e levar o campo ao centro da área visível.
- Desligar apenas o desfoque do fundo enquanto o teclado estiver aberto, mantendo o escurecimento.
- Impedir foco automático ao abrir painéis com formulários, incluindo o cadastro de peças e os demais usos encontrados em Clientes, Valores, Dados da empresa, Orçamentos e Apontamentos.
- Restringir a animação dos rótulos flutuantes a posição, tamanho e cor por 150 ms; manter todos os campos com fonte mínima de 16 px.

## Validação
- Testar em viewport de iPhone o cadastro de peça, percorrendo Nome, Código, Unidade, Valor e Observações até Salvar.
- Confirmar abertura e fechamento do teclado sem salto, campo focado legível, rolagem interna, ausência de duplicação visual e retorno correto do painel.
- Repetir em outros painéis de formulário relevantes e simular modo avião para confirmar que a correção é somente visual.
- Conferir ausência de rolagem horizontal, erros no console e erros de compilação.

## Limites
- Nenhuma alteração em banco, dados, regras de salvamento, rotas, IDs, fila offline ou configuração de viewport.
