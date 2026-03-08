const REQUIRE_CHAT_UNLOCK = import.meta.env.PROD;
const CHAT_PASSWORD = (import.meta.env.VITE_CHAT_PASSWORD ?? "").trim();
const STORAGE_KEY = "chat-auth";

let isAuthenticated = false;
const listeners = new Set<() => void>();

function loadFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveToStorage(authenticated: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (authenticated) {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

function notify(): void {
  listeners.forEach((cb) => cb());
}

let loaded = false;

export function getRequiresPasswordUnlock(): boolean {
  return REQUIRE_CHAT_UNLOCK;
}

export function isPasswordConfigured(): boolean {
  return CHAT_PASSWORD.length > 0;
}

export function getIsAuthenticated(): boolean {
  if (!REQUIRE_CHAT_UNLOCK) {
    return true;
  }

  if (!isPasswordConfigured()) {
    return false;
  }

  if (typeof window !== "undefined" && !loaded) {
    loaded = true;
    isAuthenticated = loadFromStorage();
  }

  return isAuthenticated;
}

export function login(password: string): boolean {
  if (!REQUIRE_CHAT_UNLOCK) {
    return true;
  }

  if (!isPasswordConfigured()) {
    return false;
  }

  const ok = password === CHAT_PASSWORD;
  if (ok) {
    isAuthenticated = true;
    saveToStorage(true);
    notify();
  }

  return ok;
}

export function logout(): void {
  if (!REQUIRE_CHAT_UNLOCK) return;
  isAuthenticated = false;
  saveToStorage(false);
  notify();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}