import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Ellipsis, FileArchive, House } from "lucide-react";

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
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card">
        <ul className="mx-auto grid max-w-md grid-cols-4 px-2 py-1">
          {items.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              {to === "/mais" ? (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Mais opções"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen(true)}
                  className={`flex h-auto min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-none px-0.5 py-1 text-[0.7rem] font-medium ${moreOpen ? "text-primary" : "text-muted-foreground"}`}
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
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[0.7rem] font-medium text-muted-foreground transition-colors duration-200 data-[status=active]:font-semibold data-[status=active]:text-primary [&[data-status=active]_svg]:fill-primary/15`}
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
        </ul>
      </nav>
      <PagamentosBanner relatorios={relatorios} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
