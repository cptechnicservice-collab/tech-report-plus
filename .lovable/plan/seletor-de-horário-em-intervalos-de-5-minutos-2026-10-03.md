# Seletor de horário em intervalos de 5 minutos

## Objetivo
Trocar a escolha de horários dos apontamentos por um seletor de rolagem, semelhante ao calendário do celular, com minutos de 5 em 5.

## Alterações
- Criar um seletor reutilizável de horário em painel flutuante, com duas rodas verticais: horas (`00` a `23`) e minutos (`00`, `05`, `10` ... `55`).
- Destacar a opção central, encaixar automaticamente cada opção durante a rolagem e permitir selecionar tanto por toque quanto por arraste.
- Manter os botões **Cancelar**, **Confirmar** e **Limpar**, preservando horários opcionais.
- Usar o novo seletor em todos os horários do apontamento: viagem de ida, trabalho, intervalo e viagem de retorno.
- Ao abrir um horário já salvo, posicionar as rodas no valor atual; nenhum registro será alterado até tocar em **Confirmar**.
- Manter cálculos, validações, salvamento, rascunho e funcionamento offline exatamente como estão.

## Apresentação e acessibilidade
- Seguir as cores e os componentes atuais do CP TECHNIC.
- Garantir área de toque adequada, leitura clara do horário selecionado, fechamento pelo fundo ou botão X e suporte a movimento reduzido.
- Manter o painel acima da área segura do iPhone e sem rolagem horizontal.

## Arquivos previstos
- Novo componente compartilhado para a seleção por rolagem.
- `src/components/ApontamentoForm.tsx` para usar o seletor nos campos de horário.
- `src/styles.css` apenas se forem necessários estilos de encaixe da rolagem.
- `AGENTS.md` e `roadmap.md` para registrar a decisão e a conclusão.

## Validação
- Testar no tamanho do iPhone a seleção por toque e por rolagem.
- Confirmar que os minutos disponíveis avançam somente de 5 em 5.
- Testar todos os pares de horários, limpeza, cancelamento, edição de valor salvo e funcionamento offline.
- Confirmar compilação sem erros.
