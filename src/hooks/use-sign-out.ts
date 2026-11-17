import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { clearOfflineUserData } from "@/lib/offline";
import { clearConfirmedUser } from "@/lib/auth-session";

/** Mesma limpeza usada antes pelo botão de sair do cabeçalho. */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await clearOfflineUserData();
    clearConfirmedUser();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  };
}
