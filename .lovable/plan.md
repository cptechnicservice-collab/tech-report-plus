# Corrigir travamentos no iPhone

## Objetivo
Evitar que o app fique preso ao abrir, voltar do segundo plano ou renovar a sessão no iPhone.

## O que será feito
- Retirar a revalidação de acesso de dentro do aviso de autenticação, evitando o ciclo que pode bloquear a navegação.
- Fazer a proteção das telas usar primeiro a sessão já salva no aparelho, sem depender de uma nova resposta da internet a cada troca de tela.
- Adicionar limite de espera às leituras de clientes, apontamentos, valores e agenda, usando o conteúdo salvo no aparelho quando a conexão falhar.
- Tornar a atualização do status offline segura quando a tela já tiver sido fechada.
- Manter login, privacidade, fila offline e dados existentes sem alterações.

## Verificação
- Testar abertura, login, troca entre abas e retorno do segundo plano em tamanho de iPhone.
- Confirmar que o app abre com internet lenta/offline usando os dados salvos.
- Conferir erros registrados e compilação após a correção.
