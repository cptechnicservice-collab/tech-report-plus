import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Ellipsis, FileArchive, House, Plus } from "lucide-react";

import { MoreSheet } from "@/components/MoreSheet";
import { Button } from "@/components/ui/button";
import { PagamentosBanner } from "@/components/PagamentosAlertas";
import { urgentes } from "@/lib/parcelas";
import { relatoriosConfirmados, fetchRelatoriosSalvos } from "@/lib/relatorios";

const items = [
  { to: "/painel", label: "Início", icon: House, exact: true },
  { to: "/historico", label: "Histórico", icon: Clock, exact: false },
  { to: "/relatorios-salvos", label: "Relatórios", icon: FileArchive, exact: false },
  { to: "/mais", label: "Mais", icon: Ellipsis, exact: false },
] as const;

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: relatorios = [] } = useQuery({ queryKey: ["relatorios-salvos"], queryFn: fetchRelatoriosSalvos, select: relatoriosConfirmados });
  const urgentesCount = urgentes(relatorios).length;

  return (
    <>
      <nav aria-label="Navegação principal" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-40 mx-auto max-w-lg rounded-[28px] border border-border bg-card/95 shadow-nav backdrop-blur-md">
        <ul className="grid grid-cols-5 items-center gap-1 px-2 py-2">
          {items.map(({ to, label, icon: Icon, exact }) => (
            <li key={to} className={to === "/relatorios-salvos" ? "col-start-4" : to === "/mais" ? "col-start-5" : ""}>
              {to === "/mais" ? (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Mais opções"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen(true)}
                  className={`flex h-auto min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-[20px] px-0.5 py-1 text-[0.7rem] font-medium ${moreOpen ? "bg-nav-active text-foreground" : "text-muted-foreground"}`}
                >
                  <span className="relative grid h-7 w-7 place-items-center">
                    <Icon className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  <span className="truncate">{label}</span>
                </Button>
              ) : (
                <Link
                  to={to}
                  activeOptions={{ exact }}
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[20px] px-0.5 py-1 text-[0.7rem] font-medium text-muted-foreground transition-colors duration-200 data-[status=active]:font-semibold data-[status=active]:text-foreground data-[status=active]:bg-nav-active`}
                >
                  <span className="relative grid h-7 w-7 place-items-center">
                    {to === "/relatorios-salvos" && urgentesCount > 0 ? <span aria-label={`${urgentesCount} pagamento(s) urgente(s)`} className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold leading-none text-destructive-foreground">{urgentesCount}</span> : null}
                    <Icon className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  <span className="truncate">{label}</span>
                </Link>
              )}
            </li>
          ))}
          <li className="col-start-3 row-start-1 flex justify-center">
            <Button asChild className="-mt-7 h-16 w-16 rounded-[22px] shadow-glow ring-[6px] ring-background" aria-label="Novo apontamento">
              <Link to="/novo" search={{ data: undefined, cliente: undefined, servico: undefined, agenda: undefined, orcamento: undefined }}><Plus className="size-7!" strokeWidth={2} /></Link>
            </Button>
          </li>
        </ul>
      </nav>
      <PagamentosBanner relatorios={relatorios} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
