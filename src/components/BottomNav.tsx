import { Link } from "@tanstack/react-router";
import { CalendarPlus, Clock, LayoutGrid, Users } from "lucide-react";

const items = [
  { to: "/", label: "Resumo", icon: LayoutGrid, exact: true },
  { to: "/novo", label: "Apontar", icon: CalendarPlus, exact: false },
  { to: "/historico", label: "Histórico", icon: Clock, exact: false },
  { to: "/clientes", label: "Clientes", icon: Users, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pt-1.5 backdrop-blur-xl [box-shadow:var(--shadow-nav)]">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {items.map(({ to, label, icon: Icon, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact }}
              className="flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[0.68rem] font-medium text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <Icon className="h-6 w-6" strokeWidth={1.8} />
              <span className="truncate">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
