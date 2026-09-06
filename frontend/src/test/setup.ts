import { vi } from "vitest";
import { resetNavConfig } from "../lib/nav";
import { resetUiCopy } from "../lib/uiCopy";
import { viteTestEnv } from "./viteEnv";

for (const [key, value] of Object.entries(viteTestEnv)) {
  vi.stubEnv(key, value);
}

resetNavConfig();
resetUiCopy();
