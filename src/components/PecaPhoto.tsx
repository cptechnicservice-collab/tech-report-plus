import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { fetchPeca } from "@/lib/pecas";

export function PecaPhoto({ id }: { id: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "100px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { data } = useQuery({ queryKey: ["peca-completa", id], queryFn: () => fetchPeca(id), enabled: visible, meta: { heavy: true }, networkMode: "always" });
  return <span ref={ref} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
    {data?.foto_data_url ? <img src={data.foto_data_url} loading="lazy" alt="" className="h-12 w-12 rounded-xl object-cover" /> : <Package className="h-6 w-6" />}
  </span>;
}