# CP TECHNIC Horas

Aplicativo de campo otimizado para iPhone: apontamentos manuais de trabalho e viagem,
clientes, peças, tarifas com vigência, orçamentos, relatórios e recibos PDF,
recebimentos e parcelas. Os dados locais e a fila de sincronização permitem trabalhar
sem internet, mantendo o isolamento por usuário. O status operacional do relatório
é independente do status financeiro.

**Aplicativo:** https://tech-report-plus.lovable.app

## Desenvolvimento local

Requisitos: Node.js 22 e Bun 1.3.3.

```sh
bun install --frozen-lockfile
# Configure as variáveis abaixo no seu ambiente local.
bun run dev
```

A aplicação usa TanStack Start, React e Tailwind CSS. O servidor de produção é
compatível com o ambiente de execução da plataforma; não adicionar dependências
que precisem resolver arquivos ou módulos Node em tempo de execução.

## Variáveis de ambiente

`.env.example` documenta os nomes sem valores reais:

| Variável | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | Endereço do serviço de dados/autenticação |
| `VITE_SUPABASE_PROJECT_ID` | Identificador do ambiente conectado |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública do cliente; acesso limitado pelas políticas por usuário |

No Lovable Cloud, essas variáveis e os clientes correspondentes são gerenciados
pela plataforma. Não reescrever `.env`, clientes gerados ou configuração Git.
Fora da plataforma, configure as variáveis no ambiente de desenvolvimento/hospedagem.
Nunca colocar chaves privadas, tokens ou senhas em variáveis `VITE_*` ou no repositório.

## Verificações de qualidade

```sh
bun run lint
bun run typecheck
bun run test
bun run test:watch
```

Vitest cobre durações diurnas/noturnas, intervalos, KM, validação de apontamentos,
situação financeira, numeração, tarifas, descontos e parcelas/vencimentos.
Os testes de cálculo substituem o cliente de dados e nunca alteram registros reais.
O workflow `.github/workflows/ci.yml` roda lint, verificação de tipos e testes
em pushes e pull requests para `main`. A formatação legada é reportada como aviso;
erros de código continuam bloqueando a verificação. Clientes gerados são excluídos.

## Migrations Drizzle

O esquema está em `drizzle/schema.ts`; SQL versionado e seu histórico estão em
`drizzle/migrations/`. Antes de aplicar alterações, revise o SQL, faça backup e
teste em um ambiente separado. Não use `drizzle-kit push` para substituir o histórico.

**Lovable Cloud:** solicite a aplicação da migration pela plataforma. O acesso de
migration é gerenciado; credenciais administrativas não são fornecidas ao cliente.
Não reaplique migrations já executadas pela plataforma com um histórico separado.

**PostgreSQL externo/local:** configure `LOVABLE_DB_MIGRATION_URL` no ambiente
com uma conexão autorizada para migrations (nunca uma variável `VITE_*`), e execute:

```sh
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

O segundo comando usa `drizzle.config.ts` e o journal do Drizzle. Em uma base
existente, confirme primeiro a compatibilidade entre o histórico da base e o journal;
nunca execute a criação inicial novamente sobre dados existentes. Revise políticas
por usuário e permissões junto com cada nova tabela. Nenhuma migration foi criada
para esta reorganização de código.

## Organização e funcionamento offline

`src/lib/offline.ts` e `src/lib/pdf-report.ts` são interfaces públicas estáveis.
Os módulos auxiliares separam armazenamento/cache, fila, sincronização, operações
por entidade e montagem de documentos (utilitários, cabeçalho, layout e tabelas).

O worker do aplicativo é gerado pelo `vite-plugin-pwa` durante o build, em `/sw.js`.
A versão dos caches vem do identificador de CI, ou de um identificador do build.
Navegações usam NetworkFirst; assets com hash usam CacheFirst; assets estáticos
não versionados usam StaleWhileRevalidate. O manifesto e os ícones existentes
são preservados. O único registro está em `register-app-worker.ts` e é desativado
no desenvolvimento, em previews/iframes e com `?sw=off`.
O modo offline do aplicativo instalado deve ser validado no aplicativo publicado,
após carregá-lo online; o editor não registra o worker.
