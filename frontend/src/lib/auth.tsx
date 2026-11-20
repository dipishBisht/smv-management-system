"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, post, setApiToken, setUnauthorizedHandler } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
const Ctx = createContext<AuthState | null>(null);
const KEY = "optronix.auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setApiToken(null);
    localStorage.removeItem(KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    const stored = localStorage.getItem(KEY);
    if (!stored) {
      setReady(true);
      return;
    }
    try {
      const { token } = JSON.parse(stored);
      setApiToken(token);
      // Re-validate: role/active flag may have changed since the token was issued.
      api<{ user: User }>("/auth/me")
        .then((r) => setUser(r.user))
        .catch(() => logout())
        .finally(() => setReady(true));
    } catch {
      logout();
      setReady(true);
    }
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await post<{ token: string; user: User }>("/auth/login", {
      email,
      password,
    });
    setApiToken(r.token);
    localStorage.setItem(KEY, JSON.stringify({ token: r.token }));
    setUser(r.user);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
};
