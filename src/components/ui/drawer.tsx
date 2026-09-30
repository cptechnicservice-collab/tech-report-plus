import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

function useFocusedFieldVisibility() {
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return React.useCallback((event: React.FocusEvent<HTMLElement>) => {
    const target = event.target;
    const container = event.currentTarget;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    if (target instanceof HTMLInputElement && target.type === "file") return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({
          block: "center",
          behavior: reducedMotion ? "auto" : "smooth",
        });
        const visibleHeight = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--vvh"),
        ) || window.visualViewport?.height || window.innerHeight;
        const visibleTop = window.visualViewport?.offsetTop ?? 0;
        const targetRect = target.getBoundingClientRect();
        const panelRect = container.getBoundingClientRect();
        const visibleBottom = Math.min(panelRect.bottom, visibleTop + visibleHeight);
        const visiblePanelTop = Math.max(panelRect.top, visibleTop);
        const delta = targetRect.top + targetRect.height / 2 - (visiblePanelTop + visibleBottom) / 2;
        if (Math.abs(delta) > 1) container.scrollBy({ top: delta, behavior: reducedMotion ? "auto" : "smooth" });
      }, 250);
  }, []);
}

function setForwardedRef<T>(forwardedRef: React.ForwardedRef<T>, value: T | null) {
  if (typeof forwardedRef === "function") forwardedRef(value);
  else if (forwardedRef) forwardedRef.current = value;
}

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("keyboard-overlay fixed inset-0 z-50 bg-foreground/80", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & { overlayClassName?: string }
>(({ className, children, overlayClassName, onFocusCapture, ...props }, ref) => {
  const contentRef = React.useRef<React.ElementRef<typeof DrawerPrimitive.Content>>(null);
  const handleFieldFocus = useFocusedFieldVisibility();

  return (
    <DrawerPortal>
      <DrawerOverlay className={overlayClassName} />
      <DrawerPrimitive.Content
        ref={(node) => {
          contentRef.current = node;
          setForwardedRef(ref, node);
        }}
        onFocusCapture={(event) => {
          onFocusCapture?.(event);
          handleFieldFocus(event);
        }}
        className={cn(
          "keyboard-panel fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[calc(var(--vvh,100dvh)-0.75rem)] flex-col overflow-y-auto overscroll-contain rounded-t-[10px] border bg-background pb-[calc(env(safe-area-inset-bottom)+1rem)] transition-[bottom,max-height] duration-150",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
