# Plano: autenticação tolerante a modo avião

## Confirmação dos riscos

A versão instalada é `@supabase/supabase-js 2.116.0` com `@supabase/auth-js 2.116.0`.

- `getUser()` sempre consulta o servidor de autenticação. A guarda atual redireciona quando recebe qualquer erro; portanto, uma simples falha de rede pode levar o técnico para `/auth`.
- `getSession()` lê a sessão persistida, mas, quando o token de acesso está expirado, tenta renová-lo. Nessa versão, uma falha de rede é tratada como recuperável e não apaga a sessão armazenada, porém a chamada devolve sessão nula com erro enquanto o token está expirado. Assim, o `activeUserId()` atual perde temporariamente o usuário, impedindo salvamentos e ocultando a fila.
- O cliente já usa sessão persistente e renovação automática. O problema é a ausência de uma identidade local confiável durante a falha transitória, não a configuração da renovação.

## Alteração proposta

1. **Criar uma fonte local segura de identidade offline**
   - Guardar somente o `userId` da última sessão confirmada, nunca tokens ou dados sensíveis adicionais.
   - Atualizar essa identidade após login, restauração válida e renovação do token.
   - Removê-la no logout voluntário e quando o servidor rejeitar explicitamente a sessão estando online.
   - Disponibilizar uma função única que retorne: sessão validada, identidade offline temporária ou ausência real de login.

2. **Tornar a proteção das telas tolerante à rede**
   - Primeiro consultar a sessão persistida.
   - Online, validar/renovar normalmente com o servidor.
   - Offline, ou diante de erro comprovadamente transitório de rede, permitir a entrada usando o mesmo `userId` confirmado anteriormente.
   - Redirecionar para `/auth` somente quando não houver identidade/sessão local ou quando houver rejeição explícita do servidor, como refresh token inválido ou revogado.
   - Aplicar a mesma decisão à rota inicial `/`, evitando que ela envie o usuário offline para o login.

3. **Manter salvamento, cache e fila ativos em modo avião**
   - Fazer `activeUserId()` usar a fonte única de identidade tolerante a offline.
   - Preservar as chaves de cache no formato atual por `userId` e filtrar a fila pelo mesmo usuário.
   - Não alterar IndexedDB, tabelas, colunas, IDs, ordem da fila, coalescência nem regras de `upsert`.
   - O indicador continuará visível para o usuário identificado localmente, mesmo com o token expirado.

4. **Recuperar automaticamente ao voltar a internet**
   - No evento de retorno da conexão, solicitar renovação/validação antes de sincronizar.
   - Em falha transitória, manter a identidade e a fila intactas para nova tentativa.
   - Em sucesso, atualizar a sessão e executar a fila existente normalmente.
   - Em rejeição explícita online, limpar apenas o estado de autenticação local e encaminhar ao login; os registros offline permanecem isolados pelo `userId`, sem serem enviados por outra conta.
   - Evitar logout causado por timeout, modo avião ou erro temporário do serviço.

## Arquivos previstos

- `src/lib/auth-session.ts` — novo módulo central para identidade local, classificação de erros e recuperação/validação da sessão.
- `src/routes/_authenticated/route.tsx` — guarda offline tolerante.
- `src/routes/index.tsx` — decisão inicial coerente ao abrir o app sem internet.
- `src/lib/offline.ts` — uso do `userId` local confirmado para cache, fila e salvamentos.
- `src/components/OfflineStatus.tsx` — renovação antes da sincronização quando a conexão retornar.
- `src/routes/__root.tsx` — manter a identidade local alinhada aos eventos reais de login, renovação, atualização e logout.
- `src/components/PageShell.tsx` — garantir limpeza explícita da identidade no botão de sair.
- `AGENTS.md` e `roadmap.md` — registrar a regra de arquitetura e a validação concluída durante a implementação.

## Validação no iPhone

1. Instalar/abrir o app, entrar online e visitar Painel, Clientes e Novo apontamento para preencher os caches.
2. Fechar completamente o app e aguardar o token expirar por mais de uma hora.
3. Ativar modo avião e abrir pelo ícone da tela inicial.
4. Confirmar que o app abre no Painel, não mostra login e exibe os dados salvos do mesmo usuário.
5. Criar e salvar um apontamento; confirmar “Salvo no aparelho”, contador pendente e persistência após fechar e abrir novamente.
6. Desativar o modo avião; confirmar renovação automática, sincronização da fila e leitura do apontamento após recarregar.
7. Repetir com uma falha de rede temporária durante a renovação e confirmar que não ocorre logout.
8. Testar uma sessão realmente revogada com internet e confirmar redirecionamento para login, sem exposição dos dados/fila a outra conta.
9. Testar logout voluntário e login com outro usuário, confirmando isolamento dos caches e operações pelo `userId`.
10. Validar também um cenário acelerado de token expirado em ambiente de teste, além do ensaio real de mais de uma hora no iPhone.

## Limites preservados

Nenhuma mudança em banco, políticas, tabelas, colunas, geração de IDs, payloads, regras de sincronização, `upsert` ou estrutura do IndexedDB. A tolerância offline será usada apenas no aparelho; autorizações do servidor continuam sendo validadas normalmente quando houver conexão.
