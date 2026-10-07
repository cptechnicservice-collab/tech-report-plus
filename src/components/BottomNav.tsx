import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Clock, FileArchive, LayoutGrid, Menu } from "lucide-react";

import { MoreSheet } from "@/components/MoreSheet";
import { Button } from "@/components/ui/button";
import { PagamentosBanner } from "@/components/PagamentosAlertas";
import { urgentes } from "@/lib/parcelas";
import { fetchRelatoriosSalvos } from "@/lib/relatorios";

const items = [
  { to: "/painel", label: "Painel", icon: LayoutGrid, exact: true },
  { to: "/historico", label: "Histórico", icon: Clock, exact: false },
  { to: "/novo", label: "Apontar", icon: CalendarPlus, exact: false },
  { to: "/relatorios-salvos", label: "Relatórios", icon: FileArchive, exact: false },
  { to: "/mais", label: "Mais", icon: Menu, exact: false },
] as const;

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: relatorios = [] } = useQuery({ queryKey: ["relatorios-salvos"], queryFn: fetchRelatoriosSalvos });
  const urgentesCount = urgentes(relatorios).length;

  return (
    <>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 bg-transparent px-4 pb-2">
        <ul className="mx-auto grid max-w-md grid-cols-5 rounded-2xl border border-border bg-card/95 px-1 py-1.5 shadow-nav backdrop-blur-xl [backdrop-filter:saturate(180%)_blur(20px)]">
          {items.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              {to === "/mais" ? (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Mais opções"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen(true)}
                  className={`flex h-auto min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-none px-0.5 py-1 text-[0.6rem] font-medium ${moreOpen ? "text-primary" : "text-muted-foreground"}`}
                >
                  <span className="grid h-7 w-7 place-items-center">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="truncate">{label}</span>
                </Button>
              ) : (
                <Link
                  to={to}
                  activeOptions={{ exact }}
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[0.6rem] font-medium text-muted-foreground transition-colors duration-200 data-[status=active]:font-semibold data-[status=active]:text-primary ${to === "/novo" ? "relative -mt-5" : ""}`}
                >
                  <span className={to === "/novo" ? "grid h-12 w-12 place-items-center rounded-full bg-brand-header text-brand-header-foreground shadow-nav" : "relative grid h-7 w-7 place-items-center"}>
                    {to === "/relatorios-salvos" && urgentesCount > 0 ? <span aria-label={`${urgentesCount} pagamento(s) urgente(s)`} className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold leading-none text-destructive-foreground">{urgentesCount}</span> : null}
                    <Icon className={to === "/novo" ? "h-6 w-6" : "h-5 w-5"} strokeWidth={1.8} />
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
