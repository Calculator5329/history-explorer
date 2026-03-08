import { useSyncExternalStore } from "react";
import { getIsAuthenticated, subscribe, login as doLogin, logout as doLogout } from "../stores/auth-store.ts";

export function useAuth() {
  const isAuthenticated = useSyncExternalStore(
    subscribe,
    getIsAuthenticated,
    () => false
  );

  return {
    isAuthenticated,
    login: doLogin,
    logout: doLogout,
  };
}
