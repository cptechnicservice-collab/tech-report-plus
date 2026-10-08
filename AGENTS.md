<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- O status operacional do relatório (`status_relatorio`) é separado do status financeiro (`pagamento_status`), pois conclusão e recebimento são fluxos independentes.
- Cada orçamento pode originar no máximo um relatório salvo, ligado por `source_orcamento_id`, para impedir duplicação acidental.
- Consultas usam cache recente de três minutos e a sincronização invalida somente as áreas alteradas, reduzindo rede sem comprometer o modo offline.
- Formulários longos mantêm rascunho local por registro e avisam antes de abandonar alterações não salvas.
- Agenda e orçamento mantêm sua origem ao iniciar um apontamento; peças do orçamento são copiadas como snapshots editáveis.
- A fila offline usa execução única, backoff por operação e intervenção manual após três falhas, preservando prioridade e coalescência.
- A autenticação no aparelho preserva somente o último userId confirmado durante falhas de rede; rejeições explícitas online encerram o acesso, mantendo cache e fila isolados por usuário.
- A navegação secundária da barra inferior abre `MoreSheet`; `/mais` permanece como fallback direto e a sincronização abre pelo evento compartilhado.
- Painéis flutuantes usam as variáveis globais `--kb-inset` e `--vvh` derivadas de `visualViewport` para permanecer acima do teclado do iPhone.
- Horários de apontamentos usam um seletor de rolagem compartilhado em intervalos de cinco minutos, mantendo valores no formato `HH:mm` para preservar cálculos e persistência.
- A visão de relatórios totais deriva seus indicadores do cache de relatórios salvos, preservando os cálculos financeiros e o funcionamento offline.
- Use shared time-duration helpers for form, history, and dashboard totals, including midnight rollover, to keep displayed and persisted calculations consistent.
- Validate time and mileage through the shared apontamento schema before both form submission and offline persistence, preserving legacy odometer fields to prevent bypasses and data loss.
- Keep environment examples value-free and use the platform-generated environment clients; generated environment and Git configuration files are platform-managed and must not be rewritten.
- Enforce odometer ordering and distinct filled work times on new database writes with NOT VALID constraints, so validation cannot be bypassed and existing records remain untouched.
- Keep offline.ts and pdf-report.ts as compatibility facades over single-purpose modules; generic offline modules must not import their facade, preventing runtime cycles.
- Test domain calculations with Vitest and a mocked generated data client; tests must never authenticate or write production records.
- Generate the app-shell worker with vite-plugin-pwa and register it only through the guarded wrapper; build-derived cache names and NetworkFirst navigation prevent stale installed shells.
- Run lint, typecheck and unit tests on main pushes and pull requests; generated clients are excluded and legacy formatting remains nonblocking to avoid rewriting platform-managed files.
