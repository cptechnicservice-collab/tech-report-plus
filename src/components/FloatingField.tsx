import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FloatingInputProps = ComponentProps<typeof Input> & { label: string; error?: string };

export function FloatingInput({ label, id, className, error, ...props }: FloatingInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="relative block">
        <Input id={id} placeholder=" " className={cn("peer h-14 rounded-xl bg-card px-3 pb-1 pt-5 shadow-none", className)} {...props} />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground transition-all peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-[0.68rem] peer-focus:font-medium peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[0.68rem] peer-[:not(:placeholder-shown)]:font-medium">
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
      <Textarea id={id} placeholder=" " className={cn("peer min-h-28 rounded-xl bg-card px-3 pb-2 pt-6 shadow-none", className)} {...props} />
      <span className="pointer-events-none absolute left-3 top-4 text-base text-muted-foreground transition-all peer-focus:top-2 peer-focus:text-[0.68rem] peer-focus:font-medium peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[0.68rem] peer-[:not(:placeholder-shown)]:font-medium">
        {label}
      </span>
    </label>
  );
}

export function FloatingSelect({ label, value, children, className, ...props }: ComponentProps<"select"> & { label: string; children: ReactNode }) {
  return (
    <label className="relative block">
      <select value={value} className={cn("ios-field h-14 w-full border px-3 pb-1 pt-5 text-base", className)} {...props}>{children}</select>
      <span className="pointer-events-none absolute left-3 top-2 text-[0.68rem] font-medium text-muted-foreground">{label}</span>
    </label>
  );
}