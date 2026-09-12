import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) return { signedIn: true };
    return { signedIn: false };
  },
  head: () => ({ meta: [
    { title: "Entrar — CP TECHNIC Horas" },
    { name: "description", content: "Entre com segurança para acessar seus apontamentos." },
    { property: "og:title", content: "Entrar — CP TECHNIC Horas" },
    { property: "og:description", content: "Acesso privado aos seus clientes, horas e valores." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { signedIn } = Route.useRouteContext();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (signedIn) {
    void navigate({ to: "/painel", replace: true });
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Confira seu e-mail para confirmar a conta.");
          setMode("login");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await navigate({ to: "/painel", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message);
      setBusy(false);
      return;
    }
    if (!result.redirected) await navigate({ to: "/painel", replace: true });
  }

  async function forgotPassword() {
    if (!email.trim()) {
      toast.error("Informe seu e-mail primeiro.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Enviamos o link de recuperação para seu e-mail.");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-5 py-[max(env(safe-area-inset-top),2rem)]">
      <div className="mb-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[1.35rem] bg-primary text-xl font-bold text-primary-foreground shadow-sm">CP</div>
        <h1 className="mt-5 text-[2rem] font-bold leading-none">CP TECHNIC Horas</h1>
        <p className="mt-2 text-sm text-muted-foreground">Seus apontamentos, privados e sempre à mão.</p>
      </div>

      <form className="ios-group space-y-4 p-5" onSubmit={submit}>
        <div>
          <h2 className="text-xl font-semibold">{mode === "login" ? "Entrar" : "Criar conta"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "Continue de onde parou." : "Comece com seus dados separados e seguros."}</p>
        </div>
        {mode === "signup" ? <div className="space-y-1.5"><Label htmlFor="name">Nome</Label><Input id="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></div> : null}
        <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground"/><Input id="email" className="pl-10" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></div>
        <div className="space-y-1.5"><Label htmlFor="password">Senha</Label><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground"/><Input id="password" className="pl-10" type="password" minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required /></div></div>
        <Button className="h-13 w-full rounded-2xl text-base" disabled={busy} type="submit">{mode === "login" ? "Entrar" : "Criar conta"}</Button>
        {mode === "login" ? <Button className="h-auto w-full" type="button" variant="link" onClick={forgotPassword}>Esqueci minha senha</Button> : null}
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/><span>ou</span><span className="h-px flex-1 bg-border"/></div>
        <Button className="h-12 w-full rounded-2xl" type="button" variant="outline" disabled={busy} onClick={googleSignIn}>Continuar com Google</Button>
        <Button className="h-auto w-full whitespace-normal text-center" type="button" variant="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}</Button>
      </form>
    </main>
  );
}