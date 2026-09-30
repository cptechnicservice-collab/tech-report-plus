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
