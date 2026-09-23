import { Link } from "@tanstack/react-router";
import { CalendarDays, CalendarPlus, Clock, LayoutGrid, Menu } from "lucide-react";

const items = [
  { to: "/painel", label: "Painel", icon: LayoutGrid, exact: true },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, exact: false },
  { to: "/novo", label: "Apontar", icon: CalendarPlus, exact: false },
  { to: "/historico", label: "Histórico", icon: Clock, exact: false },
  { to: "/mais", label: "Mais", icon: Menu, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 bg-transparent px-4 pb-2">
      <ul className="mx-auto grid max-w-md grid-cols-5 rounded-2xl border border-border bg-card/95 px-1 py-1.5 shadow-nav backdrop-blur-xl [backdrop-filter:saturate(180%)_blur(20px)]">
        {items.map(({ to, label, icon: Icon, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact }}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[0.6rem] font-medium text-muted-foreground transition-colors duration-200 data-[status=active]:font-semibold data-[status=active]:text-primary ${to === "/novo" ? "relative -mt-5" : ""}`}
            >
              <span className={to === "/novo" ? "grid h-12 w-12 place-items-center rounded-full bg-brand-header text-brand-header-foreground shadow-nav" : "grid h-7 w-7 place-items-center"}>
                <Icon className={to === "/novo" ? "h-6 w-6" : "h-5 w-5"} strokeWidth={1.8} />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
