# Ajuste fino das 3 telas para ficar igual aos mockups

Somente visual. Cálculos, salvamento, modo offline, banco e permissões não mudam. Nenhuma tela é apagada.

## Barra inferior (como no mockup)
- 4 itens: Início (Painel), Agenda, Histórico e Mais.
- Item ativo em azul com ícone preenchido; inativos em cinza; fundo branco com linha clara em cima.
- Apontar, Relatórios salvos e Resumos passam para dentro do Mais (no topo da lista), junto com o que já existe lá. O aviso de pagamentos urgentes passa a aparecer no botão Mais.

## Botão Sair
- Sai do topo de todas as telas e vai para o Mais (último item, em vermelho), com o mesmo funcionamento atual.

## Início (Painel)
- Topo sem o botão de sair: saudação grande, data e avatar redondo (abre o Mais).
- Resumo do mês: 4 quadros como no mockup, com ícone azul em círculo claro e valores sem cortar.
- Próximo atendimento: o cartão inteiro tocável com seta à direita (abre a agenda); botão de contorno "Abrir agenda" largura total; "Iniciar apontamento" continua como botão azul acima dele.
- Recentes: uma linha por cartão, como no mockup.

## Novo/Editar apontamento — etapa 1
- Cabeçalho: seta à esquerda, título e "1 de 2 • Atendimento" centralizados, barra de progresso logo abaixo.
- Cartões de Cliente e Máquina/serviço como no mockup; a data fica numa linha discreta acima deles.
- Horários: rótulo com ícone à esquerda e os dois campos lado a lado à direita na mesma linha (Saída/Chegada, Início/Fim), com relógio no campo. Linhas vazias mostram o botão tracejado "+ Adicionar ..." ocupando o lugar dos campos.
- Resumo calculado azul claro com "trabalho" e "viagem" escritos embaixo dos números.
- Botão fixo "Continuar • KM e despesas >".
- Etapa 2 com o mesmo cabeçalho, cartões com ícone em círculo (Quilometragem, Despesas, Peças, Observações), resumo azul e "Salvar apontamento".

## Histórico
- Título grande sem botões ao redor (o atalho do relatório PDF vai para uma linha discreta abaixo dos filtros).
- Botões Este mês / Cliente / Período em pílula, sem sombra.
- Faixa de totais com ícones cinza, como no mockup.
- Cartões da linha do tempo: cliente, etiqueta (verde "Sincronizado" ou cinza "Pendente de sincronização"), serviço em cinza, horário com relógio, seta à direita. "Novo a partir deste" fica num ícone pequeno no canto inferior do cartão.

## Conferência
- Fotos das 3 telas em 390×844 comparadas aos mockups; testes existentes rodados.

## Detalhes técnicos
- BottomNav: novo array de 4 itens; Apontar/Relatórios/Resumos adicionados às opções do MoreSheet e da página /mais (rotas mantidas).
- PageShell: remover botão sair; logout movido para MoreSheet e /mais reutilizando a mesma limpeza de cache/fila.
- Footer fixo do formulário recalculado para a nova altura da barra.
- Arquivos: BottomNav, MoreSheet, mais.tsx, PageShell, ApontamentoForm, TimeWheelField, painel.tsx, historico.tsx.
