import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Nova senha — CP TECHNIC Horas" },
    { name: "description", content: "Defina uma nova senha para sua conta." },
    { property: "og:title", content: "Nova senha — CP TECHNIC Horas" },
    { property: "og:description", content: "Recupere o acesso seguro ao CP TECHNIC Horas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    setRecovery(new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery" || window.location.hash.includes("access_token"));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message);
    else {
      toast.success("Senha atualizada.");
      await navigate({ to: "/painel", replace: true });
    }
  }
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-5"><form className="ios-group w-full space-y-4 p-5" onSubmit={submit}><div><h1 className="text-2xl font-bold">Criar nova senha</h1><p className="mt-1 text-sm text-muted-foreground">Escolha uma senha segura para continuar.</p></div>{recovery ? <><div className="space-y-1.5"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div><Button className="h-12 w-full" type="submit">Salvar nova senha</Button></> : <p className="text-sm text-destructive">Este link de recuperação é inválido ou expirou.</p>}</form></main>;
}