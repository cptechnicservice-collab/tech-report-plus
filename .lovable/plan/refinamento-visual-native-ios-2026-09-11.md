# Refinamento visual Native iOS

## Objetivo
Aplicar a direção “Native iOS standard” escolhida ao app inteiro, mantendo todas as funções, dados, modo offline e fluxos atuais.

## Implementação
- Refinar a base visual com fundo agrupado claro, superfícies brancas, bordas finas, sombras discretas, tipografia de sistema e espaçamento compatível com iPhone.
- Transformar o cabeçalho em uma hierarquia mais nativa, com título de tela em destaque e identidade CP TECHNIC secundária.
- Reequilibrar o Resumo com período destacado, métricas mais legíveis, ação principal ampla e lista recente no padrão iOS.
- Uniformizar formulários, seletores, campos de horário, seções opcionais, avisos, diálogos e botões para alvos de toque confortáveis.
- Refinar Clientes, Histórico e Relatório como listas e formulários agrupados, preservando exatamente filtros, edição, geração de PDF e estados offline.
- Ajustar a barra inferior para parecer uma barra de abas nativa, com fundo translúcido, safe area e estado ativo claro sem excesso visual.
- Manter o ícone CP TECHNIC já instalado como identidade do app.

## Validação
- Conferir todas as telas principais em viewport de iPhone, incluindo formulários abertos e estados vazios/preenchidos.
- Confirmar que navegação, seleção de horários, edição, filtros e controles continuam funcionando.
- Verificar ausência de sobreposição, corte de texto, erros de console e erros de compilação.

## Detalhes técnicos
- Alterações restritas à apresentação e composição dos componentes existentes.
- Reutilizar os tokens semânticos e componentes atuais; não alterar banco, cálculos, sincronização ou rotas.
- Respeitar redução de movimento e manter alvos de toque de pelo menos 44px.
