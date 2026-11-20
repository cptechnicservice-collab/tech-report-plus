import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { clearOfflineUserData } from "@/lib/offline";
import { clearConfirmedUser } from "@/lib/auth-session";
import { invalidateNavigationAccess } from "@/lib/navigation-access";

/** Mesma limpeza usada antes pelo botão de sair do cabeçalho. */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    invalidateNavigationAccess();
    await queryClient.cancelQueries();
    queryClient.clear();
    await clearOfflineUserData();
    clearConfirmedUser();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  };
}
