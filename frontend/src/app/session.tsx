import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api } from "../lib/gateway";

export type AppUser = {
  id: string;
  email: string;
  owner: boolean;
};

export type AppPersona = {
  id: string;
  handle: string;
  display_name: string;
  description: string | null;
};

type SessionState =
  | { status: "loading"; me: null; persona: null }
  | { status: "signed_out"; me: null; persona: null }
  | { status: "ready"; me: AppUser; persona: AppPersona | null };

type SessionContextValue = SessionState & {
  reloadPersona: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchPersona(): Promise<AppPersona | null> {
  try {
    const context = await api<{ persona: AppPersona }>("/api/chat");
    return context.persona;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    status: "loading",
    me: null,
    persona: null,
  });

  const reloadPersona = useCallback(async () => {
    try {
      const persona = await fetchPersona();
      setState((current) =>
        current.status === "ready" ? { ...current, persona } : current,
      );
    } catch {
      setState((current) =>
        current.status === "ready" ? { ...current, persona: null } : current,
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api<AppUser>("/api/me");
        if (cancelled) return;
        let persona: AppPersona | null = null;
        try {
          persona = await fetchPersona();
        } catch {
          persona = null;
        }
        if (cancelled) return;
        setState({ status: "ready", me, persona });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setState({ status: "signed_out", me: null, persona: null });
          return;
        }
        setState({ status: "signed_out", me: null, persona: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SessionContext.Provider value={{ ...state, reloadPersona }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return value;
}
