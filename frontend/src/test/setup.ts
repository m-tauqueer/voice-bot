import { vi } from "vitest";
import { resetNavConfig } from "../lib/nav";
import { resetUiCopy } from "../lib/uiCopy";
import { viteTestEnv } from "./viteEnv";

for (const [key, value] of Object.entries(viteTestEnv)) {
  vi.stubEnv(key, value);
}

if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

if (typeof window !== "undefined") {
  window.scrollTo = () => undefined;
}

resetNavConfig();
resetUiCopy();
