import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FloatingInputProps = ComponentProps<typeof Input> & { label: string; error?: string };

export function FloatingInput({ label, id, className, error, ...props }: FloatingInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="relative block">
        <Input id={id} placeholder=" " className={cn("peer h-16 rounded-[20px] bg-card px-4 pb-2 pt-6 text-lg shadow-none", label.includes("R$") ? "pr-12" : "", className)} {...props} />
        {label.includes("R$") ? <span aria-hidden="true" className="pointer-events-none absolute bottom-3 right-4 text-sm font-bold text-muted-foreground">R$</span> : null}
        <span className="floating-label peer-focus:text-primary">
          {label}
        </span>
      </label>
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

type FloatingTextareaProps = ComponentProps<typeof Textarea> & { label: string };

export function FloatingTextarea({ label, id, className, ...props }: FloatingTextareaProps) {
  return (
    <label className="relative block">
      <Textarea id={id} placeholder=" " className={cn("peer min-h-28 rounded-[20px] bg-card px-4 pb-3 pt-7 text-lg shadow-none", className)} {...props} />
      <span className="floating-label peer-focus:text-primary">
        {label}
      </span>
    </label>
  );
}

export function FloatingSelect({ label, value, children, className, ...props }: ComponentProps<"select"> & { label: string; children: ReactNode }) {
  return (
    <label className="relative block">
      <select value={value} className={cn("ios-field h-16 w-full border px-4 pb-2 pt-6 text-lg", className)} {...props}>{children}</select>
      <span className="floating-label peer-focus:text-primary">{label}</span>
    </label>
  );
}