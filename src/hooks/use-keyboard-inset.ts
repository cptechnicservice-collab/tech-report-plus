import { useEffect } from "react";

const KEYBOARD_OPEN_THRESHOLD = 1;

export function useKeyboardInset() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame: number | null = null;

    const update = () => {
      frame = null;
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const inset = Math.max(0, window.innerHeight - height - offsetTop);

      root.style.setProperty("--kb-inset", `${inset}px`);
      root.style.setProperty("--vvh", `${height}px`);
      root.dataset.keyboardOpen = inset > KEYBOARD_OPEN_THRESHOLD ? "true" : "false";
    };

    const scheduleUpdate = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    update();
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      root.style.setProperty("--kb-inset", "0px");
      root.style.setProperty("--vvh", `${window.innerHeight}px`);
      delete root.dataset.keyboardOpen;
    };
  }, []);
}