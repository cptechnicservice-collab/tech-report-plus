# Login persistente e dados privados

## Objetivo
Adicionar entrada por e-mail/senha e Google, manter a sessão no iPhone e garantir que cada usuário veja e altere somente seus próprios clientes, apontamentos e valores.

## O que será feito
- Criar uma tela pública de acesso com entrar, criar conta, recuperar senha e botão Google.
- Criar perfil básico por usuário, com nome de exibição, criado automaticamente no cadastro.
- Proteger todas as telas atuais; após entrar, o usuário volta ao resumo e permanece conectado até escolher sair.
- Adicionar uma opção discreta de sair no cabeçalho, preservando o visual e a navegação atuais.
- Vincular novos clientes, apontamentos e valores ao usuário conectado.
- Substituir os acessos públicos por regras que permitem somente ao proprietário ler, criar, editar e excluir seus dados.
- Manter os dados antigos sem proprietário e invisíveis, conforme escolhido; cada conta começa vazia.
- Isolar o cache e a fila offline por usuário, limpar dados locais ao sair e impedir que itens de uma conta sejam enviados pela outra.
- Excluir as rotas de autenticação do cache do app e permitir que o fluxo do Google sempre use a conexão.

## Detalhes técnicos
- A alteração do banco adicionará `user_id` opcional às três tabelas existentes, índices por usuário e políticas baseadas no usuário autenticado.
- A tabela de perfis terá acesso somente do próprio usuário e criação automática no cadastro.
- O login usará a autenticação gerenciada do Lovable Cloud; a sessão persistente será restaurada automaticamente.
- As telas existentes serão movidas para a área protegida sem mudar seus endereços visíveis.
- Ao concluir, os dois alertas de exposição solicitados serão marcados como corrigidos; nenhum outro alerta será alterado.

## Verificação
- Validar cadastro, entrada, saída, recuperação de senha e Google.
- Confirmar que uma conta não consegue ler ou alterar dados de outra.
- Confirmar salvamento e sincronização offline apenas para a conta ativa.
- Testar a experiência no tamanho de iPhone e verificar os erros do app.
