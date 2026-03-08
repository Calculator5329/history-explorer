import { useSyncExternalStore } from "react";
import {
  getIsAuthenticated,
  getRequiresPasswordUnlock,
  isPasswordConfigured,
  subscribe,
  login as doLogin,
  logout as doLogout,
} from "../stores/auth-store.ts";

export function useAuth() {
  const isAuthenticated = useSyncExternalStore(subscribe, getIsAuthenticated, () => false);

  return {
    isAuthenticated,
    requiresPasswordUnlock: getRequiresPasswordUnlock(),
    passwordConfigured: isPasswordConfigured(),
    login: doLogin,
    logout: doLogout,
  };
}