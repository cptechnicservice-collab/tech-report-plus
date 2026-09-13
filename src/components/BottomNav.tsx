import { Link } from "@tanstack/react-router";
import { CalendarDays, CalendarPlus, CircleDollarSign, Clock, LayoutGrid, Package, Users } from "lucide-react";

const items = [
  { to: "/painel", label: "Painel", icon: LayoutGrid, exact: true },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, exact: false },
  { to: "/novo", label: "Apontar", icon: CalendarPlus, exact: false },
  { to: "/historico", label: "Histórico", icon: Clock, exact: false },
  { to: "/clientes", label: "Clientes", icon: Users, exact: false },
  { to: "/pecas", label: "Peças", icon: Package, exact: false },
  { to: "/valores", label: "Valores", icon: CircleDollarSign, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pt-2 backdrop-blur-xl [backdrop-filter:saturate(180%)_blur(20px)] [box-shadow:var(--shadow-nav)]">
      <ul className="mx-auto grid max-w-lg grid-cols-7">
        {items.map(({ to, label, icon: Icon, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact }}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[0.6rem] font-medium text-muted-foreground transition-colors duration-200 data-[status=active]:font-semibold data-[status=active]:text-primary"
            >
              <Icon className="h-6 w-6" strokeWidth={1.7} />
              <span className="truncate">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
