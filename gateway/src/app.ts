import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type postgres from "postgres";
import { type GatewayConfig, corsAllowedMethods } from "./config.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerInsightRoutes } from "./routes/insights.js";
import { registerVoiceRoutes } from "./routes/voice.js";

type Sql = ReturnType<typeof postgres>;

export async function createGatewayApp(deps: {
  config: GatewayConfig;
  sql: Sql;
  redis: Redis;
}): Promise<FastifyInstance> {
  const { config, sql, redis } = deps;
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty" } }
        : {}),
    },
  });

  redis.on("error", (error) => {
    app.log.error({ err: error }, "redis error");
  });

  await app.register(cors, {
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
    methods: corsAllowedMethods(config),
  });
  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  });
  await app.register(multipart, {
    limits: { fileSize: config.ADMIN_INGEST_MAX_BYTES },
  });
  await app.register(websocket);
  await registerAuthRoutes(app, { config, sql, redis });
  await registerAdminRoutes(app, { config });
  await registerChatRoutes(app, { config, sql, redis });
  await registerInsightRoutes(app, { config, sql });
  await registerVoiceRoutes(app, { config, sql, redis });

  app.get("/health", async () => ({
    ok: true,
    service: "gateway",
  }));

  return app;
}
