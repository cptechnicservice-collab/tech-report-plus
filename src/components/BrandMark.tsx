import { cn } from "@/lib/utils";

/** Compact app identity; never replaces the logo used by documents. */
export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("brand-mark font-display", className)}>CP<span /></span>;
}