import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ITEM_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, value) => String(value * 5).padStart(2, "0"));

type WheelColumnProps = {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

function WheelColumn({ label, options, value, onChange }: WheelColumnProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const settleTimerRef = useRef<number | null>(null);
  const selectedIndex = Math.max(0, options.indexOf(value));

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    viewportRef.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior });
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => scrollToIndex(selectedIndex, "auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [scrollToIndex, selectedIndex]);

  useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
  }, []);

  const settleSelection = () => {
    const viewport = viewportRef.current;
    if (viewport?.scrollLeft) viewport.scrollLeft = 0;
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      const currentViewport = viewportRef.current;
      if (!currentViewport) return;
      currentViewport.scrollLeft = 0;
      const index = Math.max(0, Math.min(options.length - 1, Math.round(currentViewport.scrollTop / ITEM_HEIGHT)));
      onChange(options[index] ?? options[0] ?? "00");
      scrollToIndex(index);
    }, 90);
  };

  return (
    <div className="min-w-0 flex-1 overflow-x-hidden" data-vaul-no-drag>
      <p className="mb-2 text-center text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="relative h-60 overflow-hidden rounded-2xl bg-muted/45">
        <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 h-12 -translate-y-1/2 rounded-xl border border-primary/25 bg-card shadow-sm" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-muted to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-t from-muted to-transparent" />
        <div
          ref={viewportRef}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${label}-${value}`}
          tabIndex={0}
          onScroll={settleSelection}
          className="h-full w-full touch-pan-y snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain py-24 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                id={`${label}-${option}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "relative z-30 flex h-12 w-full snap-center items-center justify-center text-xl tabular-nums transition-[color,font-weight,transform] duration-150",
                  selected ? "scale-105 font-semibold text-foreground" : "font-normal text-muted-foreground",
                )}
                onClick={() => {
                  onChange(option);
                  scrollToIndex(options.indexOf(option));
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type TimeWheelFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function TimeWheelField({ label, value, onChange }: TimeWheelFieldProps) {
  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState("08");
  const [draftMinute, setDraftMinute] = useState("00");

  const openPicker = () => {
    const [savedHour, savedMinute] = value.split(":");
    const current = new Date();
    const hour = savedHour && HOURS.includes(savedHour) ? savedHour : String(current.getHours()).padStart(2, "0");
    const numericMinute = Number(savedMinute ?? current.getMinutes());
    const roundedMinute = String(Math.min(55, Math.round(numericMinute / 5) * 5)).padStart(2, "0");
    setDraftHour(hour);
    setDraftMinute(roundedMinute);
    setOpen(true);
  };

  const formattedDraft = useMemo(() => `${draftHour}:${draftMinute}`, [draftHour, draftMinute]);

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full justify-start rounded-xl border-input bg-card px-3 text-base font-normal tabular-nums"
          aria-label={`${label}: ${value || "vazio"}`}
          onClick={openPicker}
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || "--:--"}</span>
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-10 w-10 rounded-lg text-muted-foreground"
            aria-label={`Limpar ${label.toLowerCase()}`}
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent
          onOpenAutoFocus={(event) => event.preventDefault()}
          overlayClassName="bg-foreground/35 backdrop-blur-sm"
          className="mx-auto max-w-md rounded-t-3xl border-x-0 border-b-0 bg-card"
        >
          <div className="flex items-start justify-between px-5 pt-3">
            <DrawerHeader className="p-0 text-left">
              <DrawerTitle>{label}</DrawerTitle>
              <DrawerDescription>Role para escolher de 5 em 5 minutos</DrawerDescription>
            </DrawerHeader>
            <Button type="button" variant="secondary" size="icon" className="h-11 w-11 rounded-xl" aria-label="Fechar seletor" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="relative mx-auto mt-5 grid w-full max-w-xs grid-cols-2 items-end gap-3 overflow-x-hidden px-5">
            <WheelColumn label="Hora" options={HOURS} value={draftHour} onChange={setDraftHour} />
            <span className="absolute left-1/2 top-[8.3rem] z-40 -translate-x-1/2 text-xl font-semibold text-foreground">:</span>
            <WheelColumn label="Minutos" options={MINUTES} value={draftMinute} onChange={setDraftMinute} />
          </div>

          <p className="mt-4 text-center text-2xl font-semibold tabular-nums text-foreground">{formattedDraft}</p>
          <div className="grid grid-cols-2 gap-2 px-5 pb-2 pt-4">
            <Button type="button" variant="ghost" className="h-12 rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              className="h-12 rounded-xl"
              onClick={() => {
                onChange(formattedDraft);
                setOpen(false);
              }}
            >
              Confirmar
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}