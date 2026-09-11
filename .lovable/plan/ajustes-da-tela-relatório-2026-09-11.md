# Ajustes da tela Relatório

## Implementação
- Agrupar os apontamentos do cliente em atendimentos por datas consecutivas, tratando sexta-feira até segunda-feira como continuidade.
- Exibir os seis atendimentos mais recentes com período, quantidade de dias e horas; selecionar o mais recente ao escolher o cliente e permitir selecionar outro pelo toque.
- Controlar o destaque dos atalhos de período conforme a opção usada e mudar para “Personalizado” ao editar datas ou escolher um atendimento.
- Validar o intervalo “De/Até”, exibir aviso quando invertido e impedir a geração do PDF nesse estado.

## Limites
- Alterar somente `src/routes/relatorio.tsx`.
- Preservar o visual atual, os cálculos financeiros e a geração do PDF.

## Verificação
- Confirmar que o projeto compila sem erros.
