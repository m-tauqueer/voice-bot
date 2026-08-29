import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const requiredPort = z.preprocess(
  (val) => (val === undefined || val === "" ? undefined : val),
  z.coerce.number().int().positive(),
);

const optionalUrl = z.preprocess(
  (val) => (val === undefined || val === "" ? undefined : val),
  z.string().url().optional(),
);

const optionalNonEmpty = z.preprocess(
  (val) => (val === undefined || val === "" ? undefined : val),
  z.string().min(1).optional(),
);

const envFileSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  LOG_LEVEL: z.string().min(1),
  GATEWAY_HOST: z.string().min(1),
  GATEWAY_PORT: requiredPort,
  GATEWAY_PUBLIC_URL: z.string().url(),
  FRONTEND_ORIGIN: z.string().url(),
  WORKER_URL: z.string().url(),
  BYO_LLM_PUBLIC_URL: optionalUrl,
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16),
  INTERNAL_API_SECRET: z.string().min(16),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),
  AZURE_STORAGE_ACCOUNT: optionalNonEmpty,
  AZURE_STORAGE_KEY: optionalNonEmpty,
  AZURE_BLOB_CONTAINER: optionalNonEmpty,
  DEEPGRAM_API_KEY: optionalNonEmpty,
  DEEPGRAM_STT_MODEL: optionalNonEmpty,
  DEEPGRAM_STT_LANGUAGE: optionalNonEmpty,
  DEEPGRAM_TTS_VOICE: optionalNonEmpty,
});

export type GatewayConfig = z.infer<typeof envFileSchema>;

function repoRootFromHere(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../..");
}

function loadEnvFile(): void {
  const explicit = process.env.ENV_FILE;
  const candidates = [
    ...(explicit ? [explicit] : []),
    resolve(process.cwd(), ".env"),
    resolve(repoRootFromHere(), ".env"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path, override: false });
      return;
    }
  }
}

export function loadGatewayConfig(
  raw: NodeJS.ProcessEnv = process.env,
): GatewayConfig {
  loadEnvFile();
  const parsed = envFileSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid gateway environment: ${msg}`);
  }
  return parsed.data;
}
